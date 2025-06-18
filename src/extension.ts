// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ImpromptuTreeDataProvider, FileTreeItem } from './treeViewProvider';
import { getWorkspaceUri, ensureFileExists, readFileContent, writeFileContent } from './utils';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
console.log('Impromptu extension is now active!');

    // Get the workspace URI. If no workspace is open, we can't proceed.
    const workspaceUri = getWorkspaceUri();
    if (!workspaceUri) {
        vscode.window.showWarningMessage('Impromptu: No workspace folder open. Please open a folder to use this extension.');
        return;
    }

    // Initialize the Tree Data Provider for the file tree view.
    const impromptuTreeProvider = new ImpromptuTreeDataProvider(workspaceUri);

    // Register the file tree view.
    vscode.window.registerTreeDataProvider('impromptu-file-tree', impromptuTreeProvider);

    // Register commands for the "Actions" view.
    // This creates an empty panel in the "Actions" view, and the commands
    // will appear as buttons in the view's title bar due to package.json setup.
    vscode.window.createTreeView('impromptu-actions', {
        treeDataProvider: {
            getChildren: () => [], // No items inside the actions view itself
            getTreeItem: () => {
                throw new Error('Method not implemented.'); // Should not be called
            }
        }
    });

    /**
     * Command to open or create and open the .prepend.md file.
     */
    let openPrependCommand = vscode.commands.registerCommand('impromptu.openPrepend', async () => {
        const prependFilePath = vscode.Uri.joinPath(workspaceUri, '.prepend.md');
        try {
            await ensureFileExists(prependFilePath, '# Prepend Content\n\n'); // Create with default content if not exists
            const document = await vscode.workspace.openTextDocument(prependFilePath);
            await vscode.window.showTextDocument(document);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Impromptu: Failed to open .prepend.md: ${error.message}`);
        }
    });

    /**
     * Command to open or create and open the .append.md file.
     */
    let openAppendCommand = vscode.commands.registerCommand('impromptu.openAppend', async () => {
        const appendFilePath = vscode.Uri.joinPath(workspaceUri, '.append.md');
        try {
            await ensureFileExists(appendFilePath, '\n\n# Append Content'); // Create with default content if not exists
            const document = await vscode.workspace.openTextDocument(appendFilePath);
            await vscode.window.showTextDocument(document);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Impromptu: Failed to open .append.md: ${error.message}`);
        }
    });

    /**
     * Command to toggle the selection state of a file or folder in the tree view.
     * @param item The FileTreeItem to toggle.
     */
    let toggleSelectionCommand = vscode.commands.registerCommand('impromptu.toggleSelection', (item: FileTreeItem) => {
        impromptuTreeProvider.toggleSelection(item);
    });

    /**
     * Command to generate the merged prompt markdown file.
     * Reads .prepend.md, selected files, and .append.md, then combines them into a new file.
     */
    let generatePromptCommand = vscode.commands.registerCommand('impromptu.generatePrompt', async () => {
        const selectedFiles = impromptuTreeProvider.getSelectedFiles();
        if (selectedFiles.length === 0) {
            vscode.window.showInformationMessage('Impromptu: No files selected to generate prompt.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating Impromptu Prompt...",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: "Reading content..." });

            let mergedContent = '';
            const prependFilePath = vscode.Uri.joinPath(workspaceUri, '.prepend.md');
            const appendFilePath = vscode.Uri.joinPath(workspaceUri, '.append.md');

            try {
                // 1. Read .prepend.md content
                await ensureFileExists(prependFilePath, '# Prepend Content\n\n');
                mergedContent += await readFileContent(prependFilePath) + '\n\n';

                // 2. Read selected files content
                for (const filePath of selectedFiles) {
                    const relativePath = vscode.workspace.asRelativePath(filePath, false);
                    mergedContent += `--- Start of ${relativePath} ---\n\n`;
                    mergedContent += await readFileContent(filePath) + '\n\n';
                    mergedContent += `--- End of ${relativePath} ---\n\n`;
                }

                // 3. Read .append.md content
                await ensureFileExists(appendFilePath, '\n\n# Append Content');
                mergedContent += await readFileContent(appendFilePath);

                // 4. Write to a new markdown file
                const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
                const outputFileName = `impromptu_prompt_${timestamp}.md`;
                const outputFilePath = vscode.Uri.joinPath(workspaceUri, outputFileName);
                await writeFileContent(outputFilePath, mergedContent);

                // Open the generated file
                const document = await vscode.workspace.openTextDocument(outputFilePath);
                await vscode.window.showTextDocument(document);

                vscode.window.showInformationMessage(`Impromptu: Prompt generated successfully in ${outputFileName}!`);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Impromptu: Failed to generate prompt: ${error.message}`);
            }
        });
    });

    // Add disposables to the context so they are cleaned up when the extension is deactivated.
    context.subscriptions.push(
        openPrependCommand,
        openAppendCommand,
        toggleSelectionCommand,
        generatePromptCommand
    );
}

// This method is called when your extension is deactivated
export function deactivate() {
	 console.log('Impromptu extension is deactivated.');
}
