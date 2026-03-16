import os
import time
import base64
import json
import requests
from PIL import ImageGrab # For screen capture
from google import genai
from google.genai import types

# Configuration
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("Error: GEMINI_API_KEY environment variable not set.")
    exit(1)

client = genai.Client(api_key=API_KEY)

def capture_screen():
    # Capture the primary screen
    screenshot = ImageGrab.grab()
    screenshot.save("screenshot.jpg", quality=70)
    with open("screenshot.jpg", "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def analyze_screen(image_data):
    prompt = """You are a Senior AI Engineer and Developer Tools Architect.
Analyze this screenshot of a developer's environment.
Detect:
- coding errors
- terminal errors
- UI layout issues
- bad practices

Identify the programming language (Python, TypeScript, JavaScript, React, FastAPI, etc.).

Return ONLY a JSON array of objects:
[{
 "issue": "short description",
 "suggestion": "how to fix the issue",
 "severity": "low | medium | high",
 "fix_code": "corrected code snippet or null",
 "explanation": "technical explanation",
 "patch": "diff style patch (lines starting with - and +) or null",
 "language": "Detected Language",
 "file_path": "best guess of the file path being edited (e.g. src/App.tsx)"
}]"""

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=[
            prompt,
            types.Part.from_bytes(
                data=base64.b64decode(image_data),
                mime_type="image/jpeg"
            )
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )
    
    try:
        return json.loads(response.text)
    except:
        print("Failed to parse AI response")
        return []

def apply_fix(file_path, patch):
    # In terminal mode, we can try to call the local API or apply directly
    # For simplicity, we'll try to call the local server if it's running
    try:
        resp = requests.post("http://localhost:3000/api/apply-fix", json={
            "file_path": file_path,
            "patch": patch
        })
        if resp.status_code == 200:
            print(f"Successfully applied fix to {file_path}")
        else:
            print(f"Failed to apply fix: {resp.text}")
    except Exception as e:
        print(f"Error calling apply-fix API: {e}")

def main():
    print("--- S.P.E.C.T.R.E Terminal Agent Mode ---")
    print("Monitoring screen every 5 seconds...")
    
    while True:
        try:
            print("\n[SPECTRE] Capturing screen...")
            image_data = capture_screen()
            
            print("[SPECTRE] Analyzing...")
            results = analyze_screen(image_data)
            
            if results:
                for res in results:
                    print(f"\n[{res['severity'].upper()}] {res['issue']}")
                    print(f"Suggestion: {res['suggestion']}")
                    print(f"Language: {res['language']}")
                    
                    if res.get('patch') and res.get('file_path'):
                        choice = input(f"Apply fix to {res['file_path']}? (y/n): ")
                        if choice.lower() == 'y':
                            apply_fix(res['file_path'], res['patch'])
            else:
                print("[SPECTRE] No issues detected.")
                
        except Exception as e:
            print(f"Error: {e}")
            
        time.sleep(5)

if __name__ == "__main__":
    main()
