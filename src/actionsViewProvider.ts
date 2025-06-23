import {
    Uri,
    WebviewViewProvider,
    WebviewView,
    CancellationToken,
    Webview,
    commands,
    WebviewViewResolveContext,
} from "vscode"
import * as fs from "fs"

import { getNonce } from "./utils"
import { ImpromptuTreeDataProvider } from "./treeViewProvider"

export class ActionsViewProvider implements WebviewViewProvider {
    public static readonly viewType = "impromptu-actions"
    private _view?: WebviewView

    constructor(private readonly _extensionUri: Uri, private readonly _treeDataProvider: ImpromptuTreeDataProvider) {}

    public resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext,
        _token: CancellationToken
    ) {
        this._view = webviewView

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [Uri.joinPath(this._extensionUri, "web", "dist")],
        }

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

        // A message listener
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case "impromptu.generatePrompt":
                    commands.executeCommand(
                        "impromptu.generatePrompt",
                        message.text,
                        message.shouldCopy,
                        message.includeAsciiTree
                    )
                    return
                case "impromptu.openPrepend":
                    commands.executeCommand("impromptu.openPrepend")
                    return
                case "impromptu.openAppend":
                    commands.executeCommand("impromptu.openAppend")
                    return
                case "impromptu.openSettings":
                    commands.executeCommand("impromptu.openSettings")
                    return
                case "impromptu.asciiTreeStateChanged":
                    this._treeDataProvider.setAsciiTreeState(message.state)
                    return
                case "impromptu.webviewReady":
                    this._treeDataProvider.recalculateAndNotify()
                    return
            }
        }, undefined)
    }

    /**
     * Sends the character count to the webview UI.
     * @param count The total character count of selected files.
     */
    public updateCharCount(count: number) {
        if (this._view) {
            this._view.webview.postMessage({ command: "updateCharCount", count: count })
        }
    }

    private _getHtmlForWebview(webview: Webview): string {
        // Get the path to the build directory on disk
        const buildDirOnDisk = Uri.joinPath(this._extensionUri, "web", "dist")

        // Find the script and CSS files in the build directory
        let scriptFile: string | undefined
        let cssFile: string | undefined
        try {
            const files = fs.readdirSync(buildDirOnDisk.fsPath)
            scriptFile = files.find((file) => file.endsWith(".js"))
            cssFile = files.find((file) => file.endsWith(".css"))
        } catch (e) {
            console.error("Error reading web/dist directory:", e)
            // Return an error message if the build directory doesn't exist
            return getErrorHtml(
                "Build files not found. Please run 'npm run build' or 'yarn build' in the /web directory and reload the window."
            )
        }

        if (!scriptFile || !cssFile) {
            return getErrorHtml("Could not find script or CSS file in the web/dist directory.")
        }

        // Get the special URIs that VS Code requires for loading local resources in a webview
        const scriptUri = webview.asWebviewUri(Uri.joinPath(buildDirOnDisk, scriptFile))
        const cssUri = webview.asWebviewUri(Uri.joinPath(buildDirOnDisk, cssFile))

        // Use a nonce to allow only specific scripts to be run
        const nonce = getNonce()

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                
                <link rel="stylesheet" type="text/css" href="${cssUri}">
                <title>Impromptu Actions</title>
            </head>
            <body>
                <div id="app"></div>
                <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
            </body>
        </html>`
    }
}

function getErrorHtml(errorMessage: string): string {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error</title>
        </head>
        <body>
            <div style="padding: 10px; color: red;">
                <h3>Error loading Impromptu view:</h3>
                <p>${errorMessage}</p>
            </div>
        </body>
    </html>`
}
