import * as path from "path"
import {
    Event,
    EventEmitter,
    ExtensionContext,
    FileType,
    TreeDataProvider,
    TreeItemCheckboxState,
    Uri,
    window,
    workspace,
} from "vscode"

import { FileFilter } from "./fileFilter"
import { FileTreeItem, SelectionChangeEvent } from "./treeViewItem"
import { buildFileCache } from "./workspaceScanner"
import { calculateTotalPromptSize } from "./promptCalculator"

const SELECTION_STATE_KEY = "impromptu.selectedFileUris"

/**
 * Provides data for the Impromptu file tree view, coordinating the state
 * of selections and delegating file scanning and calculations.
 */
export class ImpromptuTreeDataProvider implements TreeDataProvider<FileTreeItem> {
    private _onDidChangeTreeData: EventEmitter<FileTreeItem | undefined | void> = new EventEmitter()
    readonly onDidChangeTreeData: Event<FileTreeItem | undefined | void> = this._onDidChangeTreeData.event

    private _onSelectionDidChange: EventEmitter<SelectionChangeEvent> = new EventEmitter()
    readonly onSelectionDidChange: Event<SelectionChangeEvent> = this._onSelectionDidChange.event

    private selectedFileUris: Set<string> = new Set()

    // Cache to hold all descendant file URIs for each directory.
    private descendantFilesCache: Map<string, Uri[]> = new Map()

    private filter: FileFilter
    private filterInitializationPromise: Promise<void> | undefined

    constructor(private workspaceRoot: Uri, private context: ExtensionContext) {
        this.filter = new FileFilter(this.workspaceRoot)
        this.loadSelectionState()
    }

    /**
     * Loads the persisted selection state from the workspace context.
     */
    private async loadSelectionState(): Promise<void> {
        const savedUris = this.context.workspaceState.get<string[]>(SELECTION_STATE_KEY, [])
        this.selectedFileUris = new Set(savedUris)
        console.log("Impromptu: Loaded selection state.")
        this.recalculateAndNotify()
    }

    /**
     * Saves the current selection state to the workspace context.
     */
    private async saveSelectionState(): Promise<void> {
        await this.context.workspaceState.update(SELECTION_STATE_KEY, Array.from(this.selectedFileUris))
    }

    public async recalculateAndNotify(): Promise<void> {
        const filesCharCount = await calculateTotalPromptSize(this.workspaceRoot, this.selectedFileUris)
        this._onSelectionDidChange.fire({ filesCharCount })
    }

    public isUriRelevantToSelection(uri: Uri): boolean {
        if (this.selectedFileUris.has(uri.toString())) {
            return true
        }
        const baseName = path.basename(uri.fsPath)
        if (
            (baseName === ".prepend.md" || baseName === ".append.md") &&
            path.dirname(uri.fsPath) === this.workspaceRoot.fsPath
        ) {
            return true
        }
        return false
    }

    /**
     * Lazily initializes the file filter and builds the file cache.
     * This ensures that .gitignore is read only once when needed.
     */
    private async ensureReady(): Promise<void> {
        if (!this.filterInitializationPromise) {
            this.filterInitializationPromise = this.filter.initialize()
        }
        await this.filterInitializationPromise

        // If the cache is empty, build it.
        if (this.descendantFilesCache.size === 0 && this.workspaceRoot) {
            this.descendantFilesCache = await buildFileCache(this.workspaceRoot, this.filter)
        }
    }

    getTreeItem(element: FileTreeItem): FileTreeItem {
        return element
    }

    async getChildren(element?: FileTreeItem): Promise<FileTreeItem[]> {
        await this.ensureReady()

        const parentUri = element ? element.uri : this.workspaceRoot
        const children: FileTreeItem[] = []

        try {
            const entries = await workspace.fs.readDirectory(parentUri)
            entries.sort(([aName, aType], [bName, bType]) => {
                if (aType === FileType.Directory && bType !== FileType.Directory) return -1
                if (aType !== FileType.Directory && bType === FileType.Directory) return 1
                return aName.localeCompare(bName)
            })

            for (const [name, type] of entries) {
                const uri = Uri.joinPath(parentUri, name)

                // The single source of truth for filtering
                if (this.filter.shouldIgnore(uri)) continue

                const isDir = type === FileType.Directory
                const checkboxState = isDir
                    ? this.getFolderSelectionState(uri)
                    : this.selectedFileUris.has(uri.toString())
                    ? TreeItemCheckboxState.Checked
                    : TreeItemCheckboxState.Unchecked

                children.push(new FileTreeItem(uri, isDir ? 1 : 0, checkboxState))
            }
        } catch (err: any) {
            window.showErrorMessage(`Impromptu: Error reading directory: ${parentUri.fsPath} - ${err.message}`)
        }

        return children
    }

    /**
     * Calculates the selection state of a folder based on its descendant files using the cache.
     */
    private getFolderSelectionState(dirUri: Uri): TreeItemCheckboxState {
        const descendantFiles = this.descendantFilesCache.get(dirUri.toString()) || []
        if (descendantFiles.length === 0) return TreeItemCheckboxState.Unchecked

        const selectedCount = descendantFiles.filter((fileUri) => this.selectedFileUris.has(fileUri.toString())).length

        if (selectedCount === 0) return TreeItemCheckboxState.Unchecked
        if (selectedCount === descendantFiles.length) return TreeItemCheckboxState.Checked
        return TreeItemCheckboxState.Unchecked
    }

    async updateSelectionState(item: FileTreeItem, newState: TreeItemCheckboxState) {
        const filesToUpdate = item.isFolder() ? this.descendantFilesCache.get(item.uri.toString()) || [] : [item.uri]

        for (const fileUri of filesToUpdate) {
            if (newState === TreeItemCheckboxState.Checked) {
                this.selectedFileUris.add(fileUri.toString())
            } else {
                this.selectedFileUris.delete(fileUri.toString())
            }
        }

        // Persist the new state and then refresh the view.
        await this.saveSelectionState()
        await this.recalculateAndNotify()
        this.refresh(false) // Pass false to avoid rebuilding the cache.
    }

    getSelectedFiles(): Uri[] {
        const allKnownFiles = new Set(
            Array.from(this.descendantFilesCache.values())
                .flat()
                .map((uri) => uri.toString())
        )
        this.selectedFileUris.forEach((uri) => {
            if (!allKnownFiles.has(uri)) {
                this.selectedFileUris.delete(uri)
            }
        })
        return Array.from(this.selectedFileUris).map((uriString) => Uri.parse(uriString))
    }

    /**
     * Refreshes the tree view.
     * @param rebuildCache If true, rescans the file system and re-reads .gitignore. Defaults to true.
     */
    refresh(rebuildCache: boolean = true): void {
        if (rebuildCache) {
            // Clear state to allow re-initialization
            this.filterInitializationPromise = undefined
            this.descendantFilesCache.clear()
        }
        // Firing the event will cause getChildren to run, which handles re-initialization.
        this._onDidChangeTreeData.fire()
    }
}

export { FileTreeItem }
