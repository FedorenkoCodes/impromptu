import { useState, useEffect } from "react"
import { VscodeButton, VscodeTextarea } from "@vscode-elements/react-elements"

import "./App.css"

const vscode = acquireVsCodeApi()

export function App() {
    const [additionalText, setAdditionalText] = useState("")
    const [filesCharCount, setFilesCharCount] = useState(0)

    useEffect(() => {
        // Listener for messages from the extension host
        const handleMessage = (event: MessageEvent) => {
            const message = event.data
            if (message.command === "updateCharCount") {
                setFilesCharCount(message.count)
            }
        }

        window.addEventListener("message", handleMessage)

        return () => {
            window.removeEventListener("message", handleMessage)
        }
    }, [])

    const totalCharCount = filesCharCount + additionalText.length

    // Post a message with payload to the extension backend
    const handleGenerateCommand = () => {
        vscode.postMessage({
            command: "impromptu.generatePrompt",
            text: additionalText,
        })
    }

    // A handler for commands without a payload
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

            <div className="char-counter">
                <p>Total characters: {totalCharCount.toLocaleString()}</p>
                <p className="char-counter-note">(Roughly {Math.ceil(totalCharCount / 4).toLocaleString()} tokens)</p>
            </div>

            <VscodeTextarea
                className="textarea"
                value={additionalText}
                onInput={(e: any) => setAdditionalText(e.target.value)}
                rows={5}
                placeholder="
                  Add any additional instructions here.
                  Will be added to the end of the prompt...
                  "
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
