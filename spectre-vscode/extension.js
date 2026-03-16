const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('S.P.E.C.T.R.E is now active.');

    // Register the command to open the panel
    let disposable = vscode.commands.registerCommand('spectre.openPanel', function () {
        // Create and show a new webview panel
        const panel = vscode.window.createWebviewPanel(
            'spectrePanel', // Identifies the type of the webview. Used internally
            'S.P.E.C.T.R.E', // Title of the panel displayed to the user
            vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
            {
                enableScripts: true, // Allow scripts in the webview
                retainContextWhenHidden: true, // Keep state when switching tabs
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
            }
        );

        // Set the webview's initial html content
        panel.webview.html = getWebviewContent(context, panel.webview);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'info':
                        vscode.window.showInformationMessage(message.text);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

/**
 * Get the static HTML content for the webview
 * @param {vscode.ExtensionContext} context 
 * @param {vscode.Webview} webview 
 */
function getWebviewContent(context, webview) {
    const indexPath = path.join(context.extensionPath, 'media', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    // Get the backend URL from VS Code settings
    const config = vscode.workspace.getConfiguration('spectre');
    const backendUrl = config.get('backendUrl') || 'http://localhost:3000';

    // Inject the backend URL into the HTML
    html = html.replace('{{BACKEND_URL}}', backendUrl);

    return html;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
