import { Uri } from "vscode"

import { readFileContent } from "./utils"

/**
 * Calculates the total character count of all files that will be part of the prompt.
 * @param workspaceRoot The root URI of the workspace.
 * @param selectedFileUris A set of strings representing the URIs of the selected files.
 * @returns A promise that resolves with the total character count.
 */
export async function calculateTotalPromptSize(workspaceRoot: Uri, selectedFileUris: Set<string>): Promise<number> {
    let filesCharCount = 0

    // 1. Add .prepend.md content length
    const prependUri = Uri.joinPath(workspaceRoot, ".prepend.md")
    filesCharCount += (await readFileContent(prependUri)).length

    // 2. Add selected files content length
    for (const uriString of selectedFileUris) {
        try {
            const content = await readFileContent(Uri.parse(uriString))
            // Note: This doesn't include the length of the "--- Start/End ---" separators
            // for simplicity, but it provides a very close estimate.
            filesCharCount += content.length
        } catch (error) {
            console.warn(`Could not read file for count: ${uriString}`, error)
        }
    }

    // 3. Add .append.md content length
    const appendUri = Uri.joinPath(workspaceRoot, ".append.md")
    filesCharCount += (await readFileContent(appendUri)).length

    return filesCharCount
}
