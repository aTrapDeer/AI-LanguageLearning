import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    response = requests.get(f"{BASE_URL}/health")
    print("Health Check Response:", response.json())

def test_chat(message, language):
    payload = {
        "message": message,
        "language": language
    }
    response = requests.post(
        f"{BASE_URL}/chat",
        headers={"Content-Type": "application/json"},
        data=json.dumps(payload)
    )
    print(f"\nChat Response for {language}:")
    print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    # Test health endpoint
    test_health()
    
    # Test different languages
    test_chat("Hallo, wie geht es dir?", "de")
    test_chat("Olá, como vai você?", "pt")
    test_chat("你好，最近怎么样？", "zh") 