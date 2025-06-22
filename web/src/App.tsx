import { useState, useEffect } from "react"
import { VscodeButton, VscodeTextarea, VscodeCheckbox } from "@vscode-elements/react-elements"

import "./App.css"

const vscode = acquireVsCodeApi()

export function App() {
    const [additionalText, setAdditionalText] = useState("")
    const [filesCharCount, setFilesCharCount] = useState(0)
    const [shouldCopy, setShouldCopy] = useState(false)

    useEffect(() => {
        // Listener for messages from the extension host
        const handleMessage = (event: MessageEvent) => {
            const message = event.data
            if (message.command === "updateCharCount") {
                setFilesCharCount(message.count)
            }
        }

        window.addEventListener("message", handleMessage)

        const previousState = vscode.getState() as { shouldCopy?: boolean }
        if (previousState?.shouldCopy) {
            setShouldCopy(previousState.shouldCopy)
        }

        return () => {
            window.removeEventListener("message", handleMessage)
        }
    }, [])

    const totalCharCount = filesCharCount + additionalText.length

    const handleCheckboxChange = (e: any) => {
        const isChecked = e.target.checked
        setShouldCopy(isChecked)
        vscode.setState({ shouldCopy: isChecked })
    }

    const handleGenerateCommand = () => {
        vscode.postMessage({
            command: "impromptu.generatePrompt",
            text: additionalText,
            shouldCopy: shouldCopy,
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
            <div className="generate-container">
                <VscodeButton className="button" onClick={handleGenerateCommand}>
                    Generate Prompt
                </VscodeButton>
                <VscodeCheckbox checked={shouldCopy} onChange={handleCheckboxChange}>
                    Copy
                </VscodeCheckbox>
            </div>

            <div className="char-counter">
                <p>Total characters: {totalCharCount.toLocaleString()}</p>
                <p className="char-counter-note">(Roughly {Math.ceil(totalCharCount / 4).toLocaleString()} tokens)</p>
            </div>

            <VscodeTextarea
                className="textarea"
                value={additionalText}
                onInput={(e: any) => setAdditionalText(e.target.value)}
                rows={5}
                placeholder="Add any additional instructions here.
                  Will be added to the end of the prompt..."
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
