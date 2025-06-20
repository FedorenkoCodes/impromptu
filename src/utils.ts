import { Uri, window, workspace } from "vscode"

// Use TextEncoder and TextDecoder for converting strings to/from Uint8Array
const textEncoder = new TextEncoder() // Defaults to utf-8
const textDecoder = new TextDecoder() // Defaults to utf-8

/**
 * Gets the URI of the first workspace folder currently open in VS Code.
 * @returns The `Uri` of the workspace folder, or `undefined` if no workspace is open.
 */
export function getWorkspaceUri(): Uri | undefined {
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        return workspace.workspaceFolders[0].uri
    }
    return undefined
}

/**
 * Ensures a file exists at the given URI. If it doesn't exist, it creates the file.
 * @param fileUri The `Uri` of the file to check/create.
 * @param initialContent The string content to write if the file is created.
 */
export async function ensureFileExists(fileUri: Uri, initialContent: string = ""): Promise<void> {
    try {
        await workspace.fs.stat(fileUri)
    } catch {
        // If stat fails, the file doesn't exist. Create it.
        await workspace.fs.writeFile(fileUri, textEncoder.encode(initialContent))
        console.log(`Impromptu: Created file: ${fileUri.fsPath}`)
    }
}

/**
 * Reads the content of a file from the given URI.
 * @param fileUri The `Uri` of the file to read.
 * @returns A promise that resolves with the file content as a string.
 * Returns an empty string if the file does not exist.
 */
export async function readFileContent(fileUri: Uri): Promise<string> {
    try {
        const contentBytes = await workspace.fs.readFile(fileUri)
        return textDecoder.decode(contentBytes)
    } catch (error) {
        window.showWarningMessage(`Impromptu: Could not read file: ${fileUri.fsPath}`)
        return "" // Return empty string if file doesn't exist or can't be read.
    }
}

/**
 * Writes content to a file at the given URI.
 * @param fileUri The `Uri` of the file to write to.
 * @param content The string content to write to the file.
 * @throws An error if writing to the file fails.
 */
export async function writeFileContent(fileUri: Uri, content: string): Promise<void> {
    try {
        await workspace.fs.writeFile(fileUri, textEncoder.encode(content))
    } catch (error: any) {
        throw new Error(`Error writing to file ${fileUri.fsPath}: ${error.message}`)
    }
}

export function getNonce() {
    let text = ""
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
}
