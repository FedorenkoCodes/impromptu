import { commands, ExtensionContext, ProgressLocation, TreeCheckboxChangeEvent, Uri, window, workspace } from "vscode"

import { ImpromptuTreeDataProvider, FileTreeItem } from "./treeViewProvider"
import { getWorkspaceUri, ensureFileExists, readFileContent, writeFileContent } from "./utils"

/**
 * Activates the Impromptu extension.
 * This function is called when your extension is activated.
 * @param context The extension context provided by VS Code.
 */
export function activate(context: ExtensionContext) {
    console.log("Impromptu extension is now active!")

    // Get the workspace URI. If no workspace is open, we can't proceed.
    const workspaceUri = getWorkspaceUri()
    if (!workspaceUri) {
        window.showWarningMessage("Impromptu: No workspace folder open. Please open a folder to use this extension.")
        return
    }

    // Initialize the Tree Data Provider for the file tree view.
    const impromptuTreeProvider = new ImpromptuTreeDataProvider(workspaceUri)

    // Register the file tree view and get a reference to it
    const fileTreeView = window.createTreeView("impromptu-file-tree", {
        treeDataProvider: impromptuTreeProvider,
        showCollapseAll: true,
        canSelectMany: false, // We're handling selection via checkboxes
    })

    // Listen for checkbox state changes
    context.subscriptions.push(
        fileTreeView.onDidChangeCheckboxState((e: TreeCheckboxChangeEvent<FileTreeItem>) => {
            // The event e.items is an array of tuples: [item, state].
            // We destructure the tuple here. This was the source of the original error.
            for (const [item, newState] of e.items) {
                if (item) {
                    // Safety check
                    impromptuTreeProvider.updateSelectionState(item, newState)
                }
            }
        })
    )

    // Register a command to refresh the tree view
    let refreshCommand = commands.registerCommand("impromptu.refresh", () => {
        impromptuTreeProvider.refresh()
    })

    // Register the "Actions" view (no tree items, just commands in title bar)
    window.createTreeView("impromptu-actions", {
        treeDataProvider: {
            getChildren: () => [], // No items inside the actions view itself
            getTreeItem: () => {
                throw new Error("Method not implemented.") // Should not be called
            },
        },
    })

    /**
     * Command to open or create and open the .prepend.md file.
     */
    let openPrependCommand = commands.registerCommand("impromptu.openPrepend", async () => {
        const prependFilePath = Uri.joinPath(workspaceUri, ".prepend.md")
        try {
            await ensureFileExists(prependFilePath, "# Prepend Content\n\n")
            const document = await workspace.openTextDocument(prependFilePath)
            await window.showTextDocument(document)
        } catch (error: any) {
            window.showErrorMessage(`Impromptu: Failed to open .prepend.md: ${error.message}`)
        }
    })

    /**
     * Command to open or create and open the .append.md file.
     */
    let openAppendCommand = commands.registerCommand("impromptu.openAppend", async () => {
        const appendFilePath = Uri.joinPath(workspaceUri, ".append.md")
        try {
            await ensureFileExists(appendFilePath, "\n\n# Append Content")
            const document = await workspace.openTextDocument(appendFilePath)
            await window.showTextDocument(document)
        } catch (error: any) {
            window.showErrorMessage(`Impromptu: Failed to open .append.md: ${error.message}`)
        }
    })

    /**
     * Command to generate the merged prompt markdown file.
     * Reads .prepend.md, selected files, and .append.md, then combines them into a new file.
     */
    let generatePromptCommand = commands.registerCommand("impromptu.generatePrompt", async () => {
        const selectedFiles = impromptuTreeProvider.getSelectedFiles()
        if (selectedFiles.length === 0) {
            window.showInformationMessage("Impromptu: No files selected to generate prompt.")
            return
        }

        window.withProgress(
            {
                location: ProgressLocation.Notification,
                title: "Generating Impromptu Prompt...",
                cancellable: false,
            },
            async (progress) => {
                progress.report({ message: "Reading content..." })

                let mergedContent = ""
                const prependFilePath = Uri.joinPath(workspaceUri, ".prepend.md")
                const appendFilePath = Uri.joinPath(workspaceUri, ".append.md")

                try {
                    // 1. Read .prepend.md content
                    await ensureFileExists(prependFilePath, "# Prepend Content\n\n")
                    mergedContent += (await readFileContent(prependFilePath)) + "\n\n"

                    // 2. Read selected files content
                    for (const filePath of selectedFiles) {
                        const relativePath = workspace.asRelativePath(filePath, false)
                        mergedContent += `--- Start of ${relativePath} ---\n\n`
                        mergedContent += (await readFileContent(filePath)) + "\n\n"
                        mergedContent += `--- End of ${relativePath} ---\n\n`
                    }

                    // 3. Read .append.md content
                    await ensureFileExists(appendFilePath, "\n\n# Append Content")
                    mergedContent += await readFileContent(appendFilePath)

                    // 4. Write to a new markdown file
                    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
                    const outputFileName = `impromptu_prompt_${timestamp}.md`
                    const outputFilePath = Uri.joinPath(workspaceUri, outputFileName)
                    await writeFileContent(outputFilePath, mergedContent)

                    // Open the generated file
                    const document = await workspace.openTextDocument(outputFilePath)
                    await window.showTextDocument(document)

                    window.showInformationMessage(`Impromptu: Prompt generated successfully in ${outputFileName}!`)
                } catch (error: any) {
                    window.showErrorMessage(`Impromptu: Failed to generate prompt: ${error.message}`)
                }
            }
        )
    })

    // Add disposables to the context so they are cleaned up when the extension is deactivated.
    context.subscriptions.push(openPrependCommand, openAppendCommand, generatePromptCommand, refreshCommand)
}

/**
 * Deactivates the extension.
 * This function is called when your extension is deactivated.
 */
export function deactivate() {
    console.log("Impromptu extension is deactivated.")
}
