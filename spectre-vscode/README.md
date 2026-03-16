# S.P.E.C.T.R.E for VS Code

System for Proactive Engineering and Code Technical Real-time Evaluation.

## Features

- **Real-time AI Debugging**: Monitors your code and terminal outputs via the SPECTRE backend.
- **Autonomous Patching**: Apply suggested fixes directly from the VS Code sidebar.
- **Multimodal Intelligence**: Leverages Gemini 3 Flash to understand complex coding patterns.
- **Voice Alerts**: Audio feedback for high-severity issues.

## Installation

1. Copy the `spectre-vscode` folder to your VS Code extensions directory:
   - Windows: `%USERPROFILE%\.vscode\extensions`
   - macOS/Linux: `~/.vscode/extensions`
2. Restart VS Code.

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Type **"S.P.E.C.T.R.E: Open Analysis Panel"** and press Enter.
3. The SPECTRE panel will open in the side editor column.

## Configuration

You can configure the backend URL in VS Code Settings:
1. Go to **Settings** (`Ctrl+,`).
2. Search for **"Spectre"**.
3. Update the **Backend Url** (default: `http://localhost:3000`).

---

*Developed with ❤️ for the next generation of AI-assisted engineering.*
