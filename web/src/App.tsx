import { useState, useEffect } from "react"
import { VscodeButton, VscodeTextarea, VscodeCheckbox, VscodeLabel } from "@vscode-elements/react-elements"

import "./App.css"

const vscode = acquireVsCodeApi()

// Define the shape of the state object for persistence
interface AppState {
    shouldCopy?: boolean
    includeAsciiTree?: boolean
    additionalText?: string
}

export function App() {
    const [additionalText, setAdditionalText] = useState("")
    const [filesCharCount, setFilesCharCount] = useState(0)
    const [shouldCopy, setShouldCopy] = useState(false)
    const [includeAsciiTree, setIncludeAsciiTree] = useState(false)

    useEffect(() => {
        // Listener for messages from the extension host
        const handleMessage = (event: MessageEvent) => {
            const message = event.data
            if (message.command === "updateCharCount") {
                setFilesCharCount(message.count)
            }
        }

        window.addEventListener("message", handleMessage)

        // Restore persisted state when the webview is first loaded
        const previousState = vscode.getState() as AppState
        if (previousState) {
            const restoredAsciiTree = previousState.includeAsciiTree || false
            setShouldCopy(previousState.shouldCopy || false)
            setIncludeAsciiTree(restoredAsciiTree)
            setAdditionalText(previousState.additionalText || "")

            // On first load, ensure the extension backend has the correct state
            vscode.postMessage({
                command: "impromptu.asciiTreeStateChanged",
                state: restoredAsciiTree,
            })
        }

        return () => {
            window.removeEventListener("message", handleMessage)
        }
    }, [])

    const totalCharCount = filesCharCount + additionalText.length

    const handleCheckboxChange = (
        e: any,
        setter: React.Dispatch<React.SetStateAction<boolean>>,
        stateKey: keyof AppState
    ) => {
        const isChecked = e.target.checked
        setter(isChecked)

        // Persist the state for the webview
        const currentState = (vscode.getState() as AppState) || {}
        vscode.setState({ ...currentState, [stateKey]: isChecked })

        // If this is the ASCII tree checkbox, notify the extension backend so it can recalculate
        if (stateKey === "includeAsciiTree") {
            vscode.postMessage({
                command: "impromptu.asciiTreeStateChanged",
                state: isChecked,
            })
        }
    }

    const handleTextChange = (e: any) => {
        const newText = e.target.value
        setAdditionalText(newText)
        vscode.setState({
            ...Object.assign({}, vscode.getState()),
            additionalText: newText,
        })
    }

    const handleGenerateCommand = () => {
        vscode.postMessage({
            command: "impromptu.generatePrompt",
            text: additionalText,
            shouldCopy: shouldCopy,
            includeAsciiTree: includeAsciiTree,
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

            <div className="generate-container">
                <VscodeCheckbox
                    checked={shouldCopy}
                    onChange={(e) => handleCheckboxChange(e, setShouldCopy, "shouldCopy")}
                >
                    Copy
                </VscodeCheckbox>
                <VscodeCheckbox
                    checked={includeAsciiTree}
                    onChange={(e) => handleCheckboxChange(e, setIncludeAsciiTree, "includeAsciiTree")}
                >
                    ASCII paths
                </VscodeCheckbox>
            </div>

            <div className="char-counter">
                <p>Total characters: {totalCharCount.toLocaleString()}</p>
                <p className="char-counter-note">(Roughly {Math.ceil(totalCharCount / 4).toLocaleString()} tokens)</p>
            </div>

            <VscodeLabel>
                <VscodeTextarea
                    className="textarea"
                    value={additionalText}
                    onInput={handleTextChange}
                    rows={5}
                    placeholder="Add any additional instructions here. Will be added to the end of the prompt..."
                ></VscodeTextarea>
            </VscodeLabel>
            <VscodeButton className="button" secondary onClick={() => handleSimpleCommand("impromptu.openPrepend")}>
                Open .prepend.md
            </VscodeButton>
            <VscodeButton className="button" secondary onClick={() => handleSimpleCommand("impromptu.openAppend")}>
                Open .append.md
            </VscodeButton>
        </div>
    )
}
