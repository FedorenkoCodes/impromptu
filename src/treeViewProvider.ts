import * as vscode from 'vscode';
import * as path from 'path';
import { readdir, stat } from 'fs/promises';
import { URI } from 'vscode-uri'

/**
 * Represents an item in the file tree view.
 * It can be a file or a folder.
 */
export class FileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly uri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public selected: boolean = false // Custom property to track selection
    ) {
        super(uri.fsPath, collapsibleState);
        this.resourceUri = uri; // Set resourceUri for proper icon/theme resolution
        this.label = path.basename(uri.fsPath); // Display only the base name in the tree
        this.description = this.isFolder() ? undefined : vscode.workspace.asRelativePath(uri, false); // Show relative path for files

        this.tooltip = this.uri.fsPath; // Full path on hover

        // Set the icon based on whether it's selected or not
        this.setIcon();

        // Register a command that will be executed when the item is clicked
        this.command = {
            command: 'impromptu.toggleSelection',
            title: 'Toggle Selection',
            arguments: [this]
        };
    }

    /**
     * Determines if the item is a folder.
     */
    isFolder(): boolean {
        return this.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ||
               this.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;
    }

    /**
     * Sets the icon for the tree item based on its selection state.
     */
    setIcon() {
        if (this.selected) {
            let light = URI.file(path.join(__filename, '..', '..', 'resources', 'check-light.svg'))
            let dark = URI.file(path.join(__filename, '..', '..', 'resources', 'check-dark.svg'))

            this.iconPath = {
                light: light,
                dark: dark
            };
        } else {
            // Use built-in VS Code icons for files and folders
            this.iconPath = this.isFolder() ? vscode.ThemeIcon.Folder : vscode.ThemeIcon.File;
        }
    }

    // Context value is used in package.json `when` clauses for context menus
    contextValue = this.isFolder() ? 'folderItem' : 'fileItem';
}

/**
 * Provides data for the Impromptu file tree view.
 * It reads the workspace files and presents them with selectable checkboxes.
 */
export class ImpromptuTreeDataProvider implements vscode.TreeDataProvider<FileTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileTreeItem | undefined | void> = new vscode.EventEmitter<FileTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<FileTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    // Use a Map to store the selection state for quicker lookup and update.
    // Key: URI string, Value: FileTreeItem (to update its `selected` property)
    private selectedItems: Map<string, FileTreeItem> = new Map();
    // A Set to store selected file URIs for easy retrieval during generation.
    private selectedFileUris: Set<string> = new Set();

    constructor(private workspaceRoot: vscode.Uri) {}

    /**
     * Returns the tree item for a given element.
     * @param element The element for which to return the tree item.
     * @returns The FileTreeItem.
     */
    getTreeItem(element: FileTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Returns the children of a given element, or the root elements if no element is provided.
     * This method recursively reads directories.
     * @param element The parent element (folder) or undefined for the root.
     * @returns An array of FileTreeItem children.
     */
    async getChildren(element?: FileTreeItem): Promise<FileTreeItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No folder in empty workspace');
            return [];
        }

        const currentPath = element ? element.uri.fsPath : this.workspaceRoot.fsPath;
        const children: FileTreeItem[] = [];

        try {
            const files = await readdir(currentPath, { withFileTypes: true });

            // Sort files and folders: folders first, then files, both alphabetically
            files.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

            for (const file of files) {
                // Ignore .vscode folder, .git folder, and the special .prepend.md and .append.md files
                if (file.name === '.vscode' || file.name === '.git' || file.name === '.prepend.md' || file.name === '.append.md' || file.name.startsWith('impromptu_prompt_')) {
                    continue;
                }

                const uri = vscode.Uri.joinPath(vscode.Uri.file(currentPath), file.name);
                const isDir = file.isDirectory();

                const treeItem = new FileTreeItem(
                    uri,
                    isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    this.selectedItems.has(uri.toString())
                );
                // Ensure the item in the map is updated if it already exists, or added if new.
                this.selectedItems.set(uri.toString(), treeItem);
                children.push(treeItem);
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Impromptu: Error reading directory: ${currentPath} - ${err}`);
            return [];
        }

        return children;
    }

    /**
     * Toggles the selection state of an item.
     * If it's a folder, it toggles all its children recursively.
     * @param item The FileTreeItem to toggle.
     */
    async toggleSelection(item: FileTreeItem) {
        if (item.isFolder()) {
            await this.toggleFolderSelection(item, !item.selected);
        } else {
            item.selected = !item.selected;
            if (item.selected) {
                this.selectedFileUris.add(item.uri.toString());
            } else {
                this.selectedFileUris.delete(item.uri.toString());
            }
            item.setIcon(); // Update the icon based on new selection state
            this._onDidChangeTreeData.fire(item); // Refresh only the toggled item
        }
    }

    /**
     * Recursively toggles the selection state of a folder and its contents.
     * @param folderItem The folder FileTreeItem.
     * @param select True to select, false to deselect.
     */
    private async toggleFolderSelection(folderItem: FileTreeItem, select: boolean) {
        folderItem.selected = select;
        folderItem.setIcon(); // Update folder icon immediately

        const children = await this.getChildren(folderItem);
        for (const child of children) {
            child.selected = select; // Set selected state for child
            child.setIcon(); // Update child icon

            if (child.isFolder()) {
                await this.toggleFolderSelection(child, select); // Recurse for subfolders
            } else {
                // Add/remove file from selectedFileUris set
                if (select) {
                    this.selectedFileUris.add(child.uri.toString());
                } else {
                    this.selectedFileUris.delete(child.uri.toString());
                }
            }
        }
        // Refresh the entire tree from the folder item down to reflect all changes
        this._onDidChangeTreeData.fire(folderItem);
    }

    /**
     * Returns an array of URIs for all currently selected files.
     */
    getSelectedFiles(): vscode.Uri[] {
        return Array.from(this.selectedFileUris).map(uriString => vscode.Uri.parse(uriString));
    }

    /**
     * Refreshes the entire tree view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}