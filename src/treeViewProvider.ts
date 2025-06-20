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
        public checkboxState: TreeItemCheckboxState = TreeItemCheckboxState.Unchecked
    ) {
        super(path.basename(uri.fsPath), collapsibleState)
        this.resourceUri = uri
        this.description = workspace.asRelativePath(uri, false)
        this.tooltip = this.uri.fsPath
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

    private selectedFileUris: Set<string> = new Set()

    // Cache to hold all descendant file URIs for each directory.
    private descendantFilesCache: Map<string, Uri[]> = new Map()
    private isCacheReady: boolean = false

    constructor(private workspaceRoot: Uri) {}

    getTreeItem(element: FileTreeItem): TreeItem {
        return element
    }

    async getChildren(element?: FileTreeItem): Promise<FileTreeItem[]> {
        if (!this.workspaceRoot) {
            return []
        }

        // Build the cache on the first run or after a refresh.
        if (!this.isCacheReady) {
            await this.buildCache()
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
                    name === "DS_Store" ||
                    name.startsWith("impromptu_prompt_") ||
                    name.endsWith("jpeg") ||
                    name.endsWith("ico")
                ) {
                    continue
                }

                const uri = Uri.joinPath(parentUri, name)
                const isDir = type === FileType.Directory

                let checkboxState: TreeItemCheckboxState
                if (isDir) {
                    checkboxState = this.getFolderSelectionState(uri)
                } else {
                    checkboxState = this.selectedFileUris.has(uri.toString())
                        ? TreeItemCheckboxState.Checked
                        : TreeItemCheckboxState.Unchecked
                }

                const treeItem = new FileTreeItem(
                    uri,
                    isDir ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
                    checkboxState
                )
                children.push(treeItem)
            }
        } catch (err: any) {
            window.showErrorMessage(`Impromptu: Error reading directory: ${parentUri.fsPath} - ${err.message}`)
        }

        return children
    }

    /**
     * Calculates the selection state of a folder based on its descendant files using the cache.
     * This method is now synchronous and fast.
     */
    private getFolderSelectionState(dirUri: Uri): TreeItemCheckboxState {
        const descendantFiles = this.descendantFilesCache.get(dirUri.toString()) || []
        if (descendantFiles.length === 0) {
            return TreeItemCheckboxState.Unchecked
        }

        let selectedCount = 0
        for (const fileUri of descendantFiles) {
            if (this.selectedFileUris.has(fileUri.toString())) {
                selectedCount++
            }
        }

        if (selectedCount === 0) {
            return TreeItemCheckboxState.Unchecked
        }
        if (selectedCount === descendantFiles.length) {
            return TreeItemCheckboxState.Checked
        }
        return TreeItemCheckboxState.Unchecked
    }

    async updateSelectionState(item: FileTreeItem, newState: TreeItemCheckboxState) {
        const isSelected = newState === TreeItemCheckboxState.Checked
        let filesToUpdate: Uri[] = []

        if (item.isFolder()) {
            // Get descendant files from the cache - very fast.
            filesToUpdate = this.descendantFilesCache.get(item.uri.toString()) || []
        } else {
            filesToUpdate = [item.uri]
        }

        for (const fileUri of filesToUpdate) {
            if (isSelected) {
                this.selectedFileUris.add(fileUri.toString())
            } else {
                this.selectedFileUris.delete(fileUri.toString())
            }
        }

        this.refresh(false) // Pass false to avoid rebuilding the cache.
    }

    getSelectedFiles(): Uri[] {
        return Array.from(this.selectedFileUris).map((uriString) => Uri.parse(uriString))
    }

    /**
     * Refreshes the tree view.
     * @param rebuildCache If true, rescans the file system. Defaults to true.
     */
    refresh(rebuildCache: boolean = true): void {
        if (rebuildCache) {
            this.isCacheReady = false
        }
        this._onDidChangeTreeData.fire()
    }

    /**
     * Populates the cache by recursively scanning the entire workspace once.
     */
    private async buildCache(): Promise<void> {
        this.descendantFilesCache.clear()
        if (this.workspaceRoot) {
            await this.scanDirectoryForCache(this.workspaceRoot)
        }
        this.isCacheReady = true
        console.log("Impromptu: File cache built.")
    }

    private async scanDirectoryForCache(dirUri: Uri): Promise<Uri[]> {
        let descendantFiles: Uri[] = []
        try {
            const entries = await workspace.fs.readDirectory(dirUri)
            for (const [name, type] of entries) {
                if (name.startsWith(".") || name.startsWith("impromptu_prompt_")) {
                    continue
                }
                const entryUri = Uri.joinPath(dirUri, name)
                if (type === FileType.Directory) {
                    // Recursively scan subdirectory and add its files to the current list
                    const subDirFiles = await this.scanDirectoryForCache(entryUri)
                    descendantFiles.push(...subDirFiles)
                } else if (type === FileType.File) {
                    descendantFiles.push(entryUri)
                }
            }
        } catch (err: any) {
            window.showErrorMessage(`Impromptu: Error scanning directory for cache: ${err.message}`)
        }

        // Store the collected list of files for the current directory
        this.descendantFilesCache.set(dirUri.toString(), descendantFiles)
        return descendantFiles
    }
}
