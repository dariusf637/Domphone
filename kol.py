import sys
import requests

def recuperer_utilisateurs():
    print("⚡ Connexion au serveur de test...")
    url = "https://typicode.com"
    
    try:
        # Requête HTTP sécurisée avec un timeout de 5 secondes
        response = requests.get(url, timeout=5)
        response.raise_for_status() # Déclenche une erreur si le serveur répond mal
        utilisateurs = response.json()
        
        # En-tête du tableau
        print(f"\n{'ID':<5} | {'NOM':<25} | {'EMAIL':<30}")
        print("-" * 68)
        
        # Affichage propre de chaque utilisateur
        for user in utilisateurs[:5]: # On limite aux 5 premiers pour l'exemple
            print(f"{user['id']:<5} | {user['name']:<25} | {user['email']:<30}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de connexion au serveur : {e}", file=sys.stderr)

if __name__ == "__main__":
    recuperer_utilisateurs()
