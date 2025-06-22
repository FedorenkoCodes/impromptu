import { Uri, workspace } from "vscode"

import { readFileContent } from "./utils"

/**
 * Calculates the total character count of all files that will be part of the prompt,
 * based on the current extension settings for headers and templates.
 * @param workspaceRoot The root URI of the workspace.
 * @param selectedFileUris A set of strings representing the URIs of the selected files.
 * @returns A promise that resolves with the total character count.
 */
export async function calculateTotalPromptSize(workspaceRoot: Uri, selectedFileUris: Set<string>): Promise<number> {
    const config = workspace.getConfiguration("impromptu")
    const fileContentTemplate = config.get<string>("fileContentTemplate", "{filePath}\n{fileContent}")
    const startOfFilesHeader = config.get<string>("startOfFilesHeader", "")

    let filesCharCount = 0

    // 1. Add .prepend.md content length
    const prependUri = Uri.joinPath(workspaceRoot, ".prepend.md")
    filesCharCount += (await readFileContent(prependUri)).length

    // 2. Add the "start of files" header if it exists and there are files selected
    if (selectedFileUris.size > 0 && startOfFilesHeader) {
        filesCharCount += startOfFilesHeader.length
    }

    // 3. Add selected files content length based on the template
    const templateShell = fileContentTemplate.replace("{fileContent}", "").replace("{filePath}", "")
    for (const uriString of selectedFileUris) {
        try {
            const fileUri = Uri.parse(uriString)
            const content = await readFileContent(fileUri)
            const relativePath = workspace.asRelativePath(fileUri, false)
            filesCharCount += content.length + templateShell.length + relativePath.length
        } catch (error) {
            console.warn(`Could not read file for count: ${uriString}`, error)
        }
    }

    // 4. Add .append.md content length
    const appendUri = Uri.joinPath(workspaceRoot, ".append.md")
    filesCharCount += (await readFileContent(appendUri)).length

    return filesCharCount
}
