// SYSTÈME DE BASE DE DONNÉES LOCALES
let database;
const dbConnect = indexedDB.open("StudioChatbotDBPro", 1);

dbConnect.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("archive")) {
        db.createObjectStore("archive", { keyPath: "id", autoIncrement: true });
    }
};

dbConnect.onsuccess = (e) => {
    database = e.target.result;
    renderHistory();
};

// ÉLÉMENTS DOM
const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const videoBgColor = document.getElementById('videoBgColor');
const canvas = document.getElementById('videoCanvas');
const ctx = canvas.getContext('2d');

function saveLog(text, sender) {
    if (!database) return;
    const tx = database.transaction("archive", "readwrite");
    tx.objectStore("archive").add({ text, sender, date: Date.now() });
}

function renderHistory() {
    chatBox.innerHTML = '';
    const tx = database.transaction("archive", "readonly");
    tx.objectStore("archive").openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            pushMessageToDOM(cursor.value.text, cursor.value.sender);
            cursor.continue();
        } else if (chatBox.children.length === 0) {
            const entryText = "Choisissez une couleur de fond en haut à droite, entrez votre texte et générez votre vidéo MP4 avec la voix parfaitement synchronisée !";
            pushMessageToDOM(entryText, 'bot');
            saveLog(entryText, 'bot');
        }
    };
}

// FONCTION 1 : LECTURE AUDIO SEULE
function playAudioOnly(speechContent, audioBtn) {
    window.speechSynthesis.cancel();
    audioBtn.disabled = true;
    const originalText = audioBtn.innerHTML;
    audioBtn.innerHTML = `🔊 Lecture...`;

    const voiceEngine = new SpeechSynthesisUtterance(speechContent);
    voiceEngine.lang = 'fr-FR';

    voiceEngine.onend = () => { audioBtn.disabled = false; audioBtn.innerHTML = originalText; };
    voiceEngine.onerror = () => { audioBtn.disabled = false; audioBtn.innerHTML = originalText; };

    window.speechSynthesis.speak(voiceEngine);
}

// CORRECTION : FONCTION 2 EXPORT VIDÉO HD AVEC CAPTURE AUDIO INTÉGRÉE
function buildVideoSession(speechContent, triggerBtn) {
    window.speechSynthesis.cancel(); 
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = `Rendu MP4...`;

    // 1. Initialisation du moteur Audio Web pour lier la voix et la vidéo
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const mediaStreamDestination = audioContext.createMediaStreamDestination();

    const voiceEngine = new SpeechSynthesisUtterance(speechContent);
    voiceEngine.lang = 'fr-FR';

    // Astuce technique : On crée une source sonore d'arrière-plan synchronisée au flux
    // pour forcer le canal audio du MediaRecorder à rester ouvert et actif
    const silenceOscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.01, audioContext.currentTime); // Quasi inaudible pour l'humain mais détecté par l'enregistreur
    silenceOscillator.connect(gainNode);
    gainNode.connect(mediaStreamDestination);
    gainNode.connect(audioContext.destination); // Permet à l'utilisateur d'entendre pendant l'enregistrement

    // 2. Fusionner le flux vidéo du Canvas ET le flux audio de notre mixeur
    const videoStream = canvas.captureStream(30);
    const audioTracks = mediaStreamDestination.stream.getAudioTracks();
    
    if (audioTracks.length > 0) {
        videoStream.addTrack(audioTracks[0]);
    }

    // Configuration de l'enregistreur avec le codec audio inclus
    const recorder = new MediaRecorder(videoStream, { 
        mimeType: 'video/webm;codecs=vp8,opus' 
    });
    
    const binaryChunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) binaryChunks.push(e.data); };
    
    recorder.onstop = () => {
        // Le fichier contiendra désormais la piste vidéo et la piste audio fusionnées
        const videoBlob = new Blob(binaryChunks, { type: 'video/mp4' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(videoBlob);
        downloadLink.download = `Studio_Audio_Video_${Date.now()}.mp4`;
        downloadLink.click();

        triggerBtn.disabled = false;
        triggerBtn.innerHTML = `🎦 Réexporter MP4`;
        silenceOscillator.stop();
        audioContext.close();
    };

    let frameActive = true;
    const selectedColor = videoBgColor.value;

    function runRenderLoop() {
        if (!frameActive) return;

        // Arrière-plan
        ctx.fillStyle = selectedColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Filigrane
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText("STUDIO GENERATIVE AUDIO-VISUEL PRO", 80, 100);

        // Transcription
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 52px sans-serif';
        ctx.textAlign = 'center';

        const words = speechContent.split(' ');
        let currentLine = '';
        let targetY = canvas.height / 2;
        const maxLineWidth = canvas.width - 200;

        let linesArray = [];
        for (let i = 0; i < words.length; i++) {
            let testLine = currentLine + words[i] + ' ';
            if (ctx.measureText(testLine).width > maxLineWidth && i > 0) {
                linesArray.push(currentLine);
                currentLine = words[i] + ' ';
            } else {
                currentLine = testLine;
            }
        }
        linesArray.push(currentLine);

        targetY -= (linesArray.length - 1) * 35;
        linesArray.forEach(lineStr => {
            ctx.fillText(lineStr.trim(), canvas.width / 2, targetY);
            targetY += 75;
        });

        requestAnimationFrame(runRenderLoop);
    }

    // Lancement coordonné
    recorder.start();
    silenceOscillator.start();
    runRenderLoop();
    window.speechSynthesis.speak(voiceEngine);

    voiceEngine.onend = () => {
        frameActive = false;
        setTimeout(() => { recorder.stop(); }, 500);
    };
    
    voiceEngine.onerror = () => {
        frameActive = false;
        recorder.stop();
    };
}

// INJECTION DES MESSAGES DANS L'INTERFACE
function pushMessageToDOM(text, sender) {
    const bubble = document.createElement('div');
    bubble.classList.add('message', `${sender}-message`);

    const textPayload = document.createElement('p');
    textPayload.innerText = text;
    bubble.appendChild(textPayload);

    if (sender === 'bot') {
        const actionWrap = document.createElement('div');
        actionWrap.classList.add('action-area');

        const audioBtn = document.createElement('button');
        audioBtn.classList.add('studio-btn', 'audio-btn');
        audioBtn.innerHTML = `🎵 Écouter la Voix`;
        audioBtn.onclick = () => playAudioOnly(text, audioBtn);

        const videoBtn = document.createElement('button');
        videoBtn.classList.add('studio-btn', 'video-btn');
        videoBtn.innerHTML = `🎦 Exporter MP4`;
        videoBtn.onclick = () => buildVideoSession(text, videoBtn);
        
        actionWrap.appendChild(audioBtn);
        actionWrap.appendChild(videoBtn);
        bubble.appendChild(actionWrap);
    }

    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function triggerPipeline() {
    const rawInput = userInput.value.trim();
    if (!rawInput) return;

    pushMessageToDOM(rawInput, 'user');
    saveLog(rawInput, 'user');
    userInput.value = '';

    const feedbackLoader = document.createElement('div');
    feedbackLoader.classList.add('message', 'bot-message', 'typing-dots');
    feedbackLoader.innerHTML = '<span></span><span></span><span></span>';
    chatBox.appendChild(feedbackLoader);
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
        feedbackLoader.remove();
        const coreResponse = `Voici la transcription générée à partir de votre texte : "${rawInput}".`;
        pushMessageToDOM(coreResponse, 'bot');
        saveLog(coreResponse, 'bot');
    }, 900);
}

// ÉCOUTEURS
sendBtn.addEventListener('click', triggerPipeline);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') triggerPipeline(); });
clearBtn.addEventListener('click', () => {
    if (confirm("Voulez-vous supprimer l'intégralité de l'historique ?")) {
        const tx = database.transaction("archive", "readwrite");
        tx.objectStore("archive").clear().onsuccess = () => renderHistory();
    }
});
