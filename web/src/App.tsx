import { useState } from "react"
import { VscodeButton, VscodeTextarea } from "@vscode-elements/react-elements"

import "./App.css"

const vscode = acquireVsCodeApi()

export function App() {
    const [additionalText, setAdditionalText] = useState("")

    // Function to post a message with payload to the extension backend
    const handleGenerateCommand = () => {
        vscode.postMessage({
            command: "impromptu.generatePrompt",
            // Send the textarea content as a 'text' payload
            text: additionalText,
        })
    }

    // A simpler handler for commands without a payload
    const handleSimpleCommand = (command: string) => {
        vscode.postMessage({
            command: command,
        })
    }

    return (
        <div className="app-container">
            <VscodeButton className="button" onClick={handleGenerateCommand}>
                Generate Prompt
            </VscodeButton>
            <VscodeTextarea
                className="textarea"
                value={additionalText}
                onInput={(e: any) => setAdditionalText(e.target.value)}
                rows={5}
                placeholder="Add any additional instructions here.
                Will be added to the end of the prompt file..."
            ></VscodeTextarea>
            <VscodeButton className="button" secondary onClick={() => handleSimpleCommand("impromptu.openPrepend")}>
                Open .prepend.md
            </VscodeButton>
            <VscodeButton className="button" secondary onClick={() => handleSimpleCommand("impromptu.openAppend")}>
                Open .append.md
            </VscodeButton>
        </div>
    )
}
