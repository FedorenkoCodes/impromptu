import "./App.css"
import { VscodeButton } from "@vscode-elements/react-elements"

// It's recommended to call acquireVsCodeApi() only once and memoize the result.
const vscode = acquireVsCodeApi()

// Function to post a message to the extension backend
const handleCommand = (command: string) => {
    vscode.postMessage({
        command: command,
    })
}

export function App() {
    return (
        <div className="app-container">
            <VscodeButton className="button" onClick={() => handleCommand("impromptu.generatePrompt")}>
                Generate Prompt
            </VscodeButton>
            <VscodeButton className="button" secondary onClick={() => handleCommand("impromptu.openPrepend")}>
                Open .prepend.md
            </VscodeButton>
            <VscodeButton className="button" secondary onClick={() => handleCommand("impromptu.openAppend")}>
                Open .append.md
            </VscodeButton>
        </div>
    )
}
