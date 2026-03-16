import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";
if (!API_KEY) {
  console.warn("[SPECTRE] Warning: GEMINI_API_KEY is not set. AI analysis will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface SpectreAnalysis {
  issue: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
  fix_code: string | null;
  explanation: string;
  patch: string | null;
  language: string;
  file_path?: string;
}

let speechQueue: string[] = [];
let isSpeaking = false;

const processSpeechQueue = () => {
  if (isSpeaking || speechQueue.length === 0 || !('speechSynthesis' in window)) return;

  isSpeaking = true;
  const text = speechQueue.shift()!;
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Configure for a more masculine American accent
  utterance.rate = 0.95;
  utterance.pitch = 0.85; // Lower pitch for more masculine feel
  
  const voices = window.speechSynthesis.getVoices();
  // Prefer Google US English Male or similar
  const preferredVoice = voices.find(v => 
    (v.name.includes('Google') || v.name.includes('Natural')) && 
    v.lang.includes('en-US') && 
    (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('guy') || v.name.toLowerCase().includes('david'))
  ) || voices.find(v => v.lang.includes('en-US'));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.onend = () => {
    isSpeaking = false;
    // Small delay between messages to avoid being annoying
    setTimeout(processSpeechQueue, 1000);
  };

  utterance.onerror = () => {
    isSpeaking = false;
    setTimeout(processSpeechQueue, 500);
  };

  window.speechSynthesis.speak(utterance);
};

export const playNotification = () => {
  if (!('AudioContext' in window || 'webkitAudioContext' in window)) return;
  
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1); // Drop to A4
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.warn("[SPECTRE] Audio notification failed:", e);
  }
};

export const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    // Avoid duplicate messages in short succession
    if (speechQueue.includes(text)) return;
    
    speechQueue.push(text);
    // Limit queue size to avoid backlog
    if (speechQueue.length > 3) {
      speechQueue = speechQueue.slice(-3);
    }
    processSpeechQueue();
  }
};

export async function analyzeScreen(base64Image: string): Promise<SpectreAnalysis[]> {
  try {
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    const imageData = base64Image.split(",")[1];
    if (!imageData) {
      console.error("[SPECTRE] Invalid image data format.");
      return [];
    }

    console.log("[SPECTRE] Calling Gemini API...");
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `You are a Senior AI Engineer and Developer Tools Architect.
Analyze this screenshot of a developer's environment (IDE, terminal, browser).

CRITICAL TASKS:
1. **File Path Extraction**: Look closely at the IDE's tab bar, window title, or status bar to identify the EXACT file path being edited. Do not guess if you can see it.
2. **Language & Framework Detection**: Identify the specific language or framework. Support includes: 
   - Web: React, Vue, Angular, Svelte, Next.js
   - Backend: Node.js, Python (FastAPI, Django, Flask), Go, Rust, Java, PHP, C# (.NET)
   - Mobile: Swift, Kotlin, Flutter, React Native
   - Systems: C, C++, Zig
3. **Issue Detection**:
   - Syntax/Logic errors in code.
   - Terminal errors or failed build logs.
   - UI/UX inconsistencies or layout breaks in browser previews.
   - Security vulnerabilities or performance anti-patterns.

Return ONLY a JSON array of objects:
[{
 "issue": "short description",
 "suggestion": "how to fix the issue",
 "severity": "low | medium | high",
 "fix_code": "corrected code snippet or null",
 "explanation": "technical explanation",
 "patch": "diff style patch (lines starting with - and +) or null",
 "language": "Detected Language/Framework",
 "file_path": "The specific file path (e.g. src/components/Button.tsx)"
}]`,
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageData,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return [];
    
    try {
      const results = JSON.parse(text) as SpectreAnalysis[];
      
      if (results.length > 0) {
        playNotification();
      }

      // Voice feedback for high severity issues
      results.forEach(res => {
        if (res.severity === 'high') {
          speak(`Warning. ${res.issue} detected.`);
        }
      });

      return results;
    } catch (parseError) {
      console.error("S.P.E.C.T.R.E: Failed to parse AI response as JSON:", text);
      return [];
    }
  } catch (error: any) {
    playNotification();
    // ... existing error handling ...
    if (error.message?.includes("INVALID_ARGUMENT")) {
      console.error("S.P.E.C.T.R.E: API rejected the image. This usually happens if the image is too small or corrupted.", error);
    } else {
      console.error("S.P.E.C.T.R.E Analysis Error:", error);
    }
    return [];
  }
}
