import * as path from "path"
import {
    Event,
    EventEmitter,
    FileType,
    TreeDataProvider,
    TreeItem,
    TreeItemCheckboxState,
    TreeItemCollapsibleState,
    Uri,
    window,
    workspace,
} from "vscode"

/**
 * Represents an item in the file tree view.
 * It can be a file or a folder.
 */
export class FileTreeItem extends TreeItem {
    constructor(
        public readonly uri: Uri,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public selected: boolean = false // Custom property to track selection
    ) {
        super(path.basename(uri.fsPath), collapsibleState)
        this.resourceUri = uri
        this.description = workspace.asRelativePath(uri, false)
        this.tooltip = this.uri.fsPath
        this.checkboxState = this.selected ? TreeItemCheckboxState.Checked : TreeItemCheckboxState.Unchecked
    }

    /**
     * Determines if the item is a folder.
     */
    isFolder(): boolean {
        return this.collapsibleState !== TreeItemCollapsibleState.None
    }

    contextValue = this.isFolder() ? "folderItem" : "fileItem"
}

/**
 * Provides data for the Impromptu file tree view.
 */
export class ImpromptuTreeDataProvider implements TreeDataProvider<FileTreeItem> {
    private _onDidChangeTreeData: EventEmitter<FileTreeItem | undefined | void> = new EventEmitter<
        FileTreeItem | undefined | void
    >()
    readonly onDidChangeTreeData: Event<FileTreeItem | undefined | void> = this._onDidChangeTreeData.event

    private itemsByUri: Map<string, FileTreeItem> = new Map()
    private selectedFileUris: Set<string> = new Set()

    constructor(private workspaceRoot: Uri) {}

    getTreeItem(element: FileTreeItem): TreeItem {
        return element
    }

    async getChildren(element?: FileTreeItem): Promise<FileTreeItem[]> {
        if (!this.workspaceRoot) {
            return []
        }

        const parentUri = element ? element.uri : this.workspaceRoot
        const children: FileTreeItem[] = []

        try {
            const entries = await workspace.fs.readDirectory(parentUri)
            entries.sort((a, b) => {
                const [aName, aType] = a
                const [bName, bType] = b
                if (aType === FileType.Directory && bType !== FileType.Directory) return -1
                if (aType !== FileType.Directory && bType === FileType.Directory) return 1
                return aName.localeCompare(bName)
            })

            for (const [name, type] of entries) {
                if (
                    name === ".vscode" ||
                    name === ".git" ||
                    name === ".prepend.md" ||
                    name === ".append.md" ||
                    name.startsWith("impromptu_prompt_")
                ) {
                    continue
                }

                const uri = Uri.joinPath(parentUri, name)
                const isDir = type === FileType.Directory
                const isSelected = this.selectedFileUris.has(uri.toString())

                const treeItem = new FileTreeItem(
                    uri,
                    isDir ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
                    isSelected
                )

                this.itemsByUri.set(uri.toString(), treeItem)
                children.push(treeItem)
            }
        } catch (err: any) {
            window.showErrorMessage(`Impromptu: Error reading directory: ${parentUri.fsPath} - ${err.message}`)
        }

        return children
    }

    /**
     * Updates the selection state of an item based on checkbox interaction.
     * @param item The FileTreeItem whose checkbox state changed.
     * @param newState The new state of the checkbox.
     */
    async updateSelectionState(item: FileTreeItem, newState: TreeItemCheckboxState) {
        const isSelected = newState === TreeItemCheckboxState.Checked

        console.log("item:", item)

        if (item.isFolder()) {
            const filesToUpdate = await this.getAllFileUrisRecursive(item.uri)
            filesToUpdate.forEach((fileUri) => {
                if (isSelected) {
                    this.selectedFileUris.add(fileUri.toString())
                } else {
                    this.selectedFileUris.delete(fileUri.toString())
                }
            })
            this.refresh() // Refresh the whole tree to show visual changes
        } else {
            const uriString = item.uri.toString()
            if (isSelected) {
                this.selectedFileUris.add(uriString)
            } else {
                this.selectedFileUris.delete(uriString)
            }
            item.selected = isSelected
            item.checkboxState = newState
            this._onDidChangeTreeData.fire(item) // Refresh just the single item
        }
    }

    /**
     * Recursively finds all file URIs under a given directory URI.
     */
    private async getAllFileUrisRecursive(dirUri: Uri): Promise<Uri[]> {
        const fileUris: Uri[] = []
        try {
            const entries = await workspace.fs.readDirectory(dirUri)
            for (const [name, type] of entries) {
                if (name.startsWith(".") || name.startsWith("impromptu_prompt_")) {
                    continue
                }
                const entryUri = Uri.joinPath(dirUri, name)
                if (type === FileType.Directory) {
                    fileUris.push(...(await this.getAllFileUrisRecursive(entryUri)))
                } else if (type === FileType.File) {
                    if (name !== ".prepend.md" && name !== ".append.md") {
                        fileUris.push(entryUri)
                    }
                }
            }
        } catch (err: any) {
            window.showErrorMessage(`Error recursively reading directory: ${err.message}`)
        }
        return fileUris
    }

    /**
     * Returns an array of URIs for all currently selected files.
     */
    getSelectedFiles(): Uri[] {
        return Array.from(this.selectedFileUris).map((uriString) => Uri.parse(uriString))
    }

    /**
     * Refreshes the entire tree view.
     */
    refresh(): void {
        this.itemsByUri.clear()
        this._onDidChangeTreeData.fire()
    }
}
