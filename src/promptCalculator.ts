import { Uri, workspace } from "vscode"

import { generateAsciiTree } from "./asciiTree"
import { readFileContent } from "./utils"

/**
 * Calculates the total character count of all files that will be part of the prompt,
 * based on the current extension settings for headers and templates.
 * @param workspaceRoot The root URI of the workspace.
 * @param selectedFileUris A set of strings representing the URIs of the selected files.
 * @param includeAsciiTree A boolean indicating if the ASCII tree should be included.
 * @param selectedUrisForTree An array of Uris for the selected files, used for tree generation.
 * @returns A promise that resolves with the total character count.
 */
export async function calculateTotalPromptSize(
    workspaceRoot: Uri,
    selectedFileUris: Set<string>,
    includeAsciiTree: boolean,
    selectedUrisForTree: Uri[]
): Promise<number> {
    const config = workspace.getConfiguration("impromptu")
    const fileContentTemplate = config.get<string>("fileContentTemplate", "{filePath}\n{fileContent}")
    const startOfFilesHeader = config.get<string>("startOfFilesHeader", "")
    const projectStructureHeader = config.get<string>("projectStructureHeader")

    let totalCharCount = 0

    // 1. .prepend.md
    totalCharCount += (await readFileContent(Uri.joinPath(workspaceRoot, ".prepend.md"))).length

    // 2. ASCII Tree
    if (includeAsciiTree && selectedUrisForTree.length > 0) {
        const asciiTree = generateAsciiTree(selectedUrisForTree, workspaceRoot)
        if (projectStructureHeader) {
            totalCharCount += `\n\n${projectStructureHeader}\n\n`.length
        }
        totalCharCount += ("```\n" + asciiTree + "```").length
    }

    // 3. "Start of files" header
    if (selectedUrisForTree.length > 0 && startOfFilesHeader) {
        totalCharCount += `\n\n${startOfFilesHeader}`.length
    }

    // 4. Selected files
    for (const uriString of selectedFileUris) {
        try {
            const fileUri = Uri.parse(uriString)
            const content = await readFileContent(fileUri)
            const relativePath = workspace.asRelativePath(fileUri, false)
            const formattedFile = fileContentTemplate
                .replaceAll("{filePath}", relativePath)
                .replace("{fileContent}", content)

            // The "\n\n" is always added before each file block in the final prompt
            totalCharCount += `\n\n${formattedFile}`.length
        } catch (error) {
            console.warn(`Could not read file for count: ${uriString}`, error)
        }
    }

    // 5. .append.md
    const appendContent = await readFileContent(Uri.joinPath(workspaceRoot, ".append.md"))
    if (appendContent) {
        totalCharCount += `\n\n${appendContent}`.length
    }

    return totalCharCount
}
