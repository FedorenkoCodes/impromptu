import {
    commands,
    env,
    ExtensionContext,
    ProgressLocation,
    TreeCheckboxChangeEvent,
    Uri,
    window,
    workspace,
} from "vscode"

import { ImpromptuTreeDataProvider, FileTreeItem } from "./treeViewProvider"
import { getWorkspaceUri, ensureFileExists, readFileContent, writeFileContent } from "./utils"
import { ActionsViewProvider } from "./actionsViewProvider"

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
    // Pass the extension context to enable state persistence.
    const impromptuTreeProvider = new ImpromptuTreeDataProvider(workspaceUri, context)
    const actionsViewProvider = new ActionsViewProvider(context.extensionUri)

    // Wire up the event listener to connect the two views
    context.subscriptions.push(
        impromptuTreeProvider.onSelectionDidChange((e) => {
            actionsViewProvider.updateCharCount(e.filesCharCount)
        })
    )

    // Create a watcher for all files in the workspace
    const fileWatcher = workspace.createFileSystemWatcher("**/*")

    // When a file is changed on disk, check if it's relevant and trigger a recount
    fileWatcher.onDidChange((uri) => {
        if (impromptuTreeProvider.isUriRelevantToSelection(uri)) {
            console.log(`Impromptu: Relevant file changed (${uri.fsPath}), recalculating count.`)
            impromptuTreeProvider.recalculateAndNotify()
        }
    })

    // When a file is created or deleted, the entire file structure might have changed.
    // We need to refresh the tree to show the new state. This also handles renames.
    fileWatcher.onDidCreate(() => {
        console.log("Impromptu: File created, refreshing tree view.")
        impromptuTreeProvider.refresh()
    })
    fileWatcher.onDidDelete(() => {
        console.log("Impromptu: File deleted, refreshing tree view.")
        impromptuTreeProvider.refresh()
    })

    // Add the watcher to the subscriptions for proper disposal on deactivation
    context.subscriptions.push(fileWatcher)

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
            for (const [item, newState] of e.items) {
                if (item) {
                    // Safety check
                    impromptuTreeProvider.updateSelectionState(item, newState)
                }
            }
        })
    )

    // Register a command to refresh the tree view
    const refreshCommand = commands.registerCommand("impromptu.refresh", () => {
        impromptuTreeProvider.refresh()
    })

    // Register a command to clear all selections
    const clearSelectionCommand = commands.registerCommand("impromptu.clearSelection", () => {
        impromptuTreeProvider.clearSelection()
    })

    // Register a command to select all files
    const selectAllCommand = commands.registerCommand("impromptu.selectAll", () => {
        impromptuTreeProvider.selectAll()
    })

    // Register a command to add file(s) to the selection from a context menu
    const addFromContextCommand = commands.registerCommand(
        "impromptu.addFromContext",
        (clickedItemUri: Uri, selectedUris: Uri[]) => {
            // `selectedUris` is populated when right-clicking in the explorer with multiple items selected.
            // `clickedItemUri` is the specific item that was right-clicked.
            const urisToAdd =
                selectedUris && selectedUris.length > 0 ? selectedUris : clickedItemUri ? [clickedItemUri] : []
            if (urisToAdd.length > 0) {
                impromptuTreeProvider.addUrisToSelection(urisToAdd)
            }
        }
    )

    context.subscriptions.push(window.registerWebviewViewProvider(ActionsViewProvider.viewType, actionsViewProvider))

    /**
     * Command to open or create and open the .prepend.md file.
     */
    const openPrependCommand = commands.registerCommand("impromptu.openPrepend", async () => {
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
    const openAppendCommand = commands.registerCommand("impromptu.openAppend", async () => {
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
    let generatePromptCommand = commands.registerCommand(
        "impromptu.generatePrompt",
        async (additionalText?: string, shouldCopy?: boolean) => {
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

                        // 4. Add additional text from the text area if it exists and is not empty
                        if (additionalText && additionalText.trim().length > 0) {
                            mergedContent += "\n\n" + additionalText.trim()
                        }

                        // 5. Write to a new markdown file
                        const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
                        const outputFileName = `impromptu_prompt_${timestamp}.md`
                        const outputFilePath = Uri.joinPath(workspaceUri, outputFileName)
                        await writeFileContent(outputFilePath, mergedContent)

                        if (shouldCopy) {
                            await env.clipboard.writeText(mergedContent)
                        }

                        // Open the generated file
                        const document = await workspace.openTextDocument(outputFilePath)
                        await window.showTextDocument(document)

                        // Show a more informative message
                        const baseMessage = `Impromptu: Prompt generated in ${outputFileName}`
                        const finalMessage = shouldCopy ? `${baseMessage} and copied to clipboard!` : `${baseMessage}!`
                        window.showInformationMessage(finalMessage)
                    } catch (error: any) {
                        window.showErrorMessage(`Impromptu: Failed to generate prompt: ${error.message}`)
                    }
                }
            )
        }
    )

    // Add disposables to the context so they are cleaned up when the extension is deactivated.
    context.subscriptions.push(
        openPrependCommand,
        openAppendCommand,
        generatePromptCommand,
        refreshCommand,
        clearSelectionCommand,
        selectAllCommand,
        addFromContextCommand
    )
}

/**
 * Deactivates the extension.
 * This function is called when your extension is deactivated.
 */
export function deactivate() {
    console.log("Impromptu extension is deactivated.")
}
