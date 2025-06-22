import * as path from "path"
import { TreeItem, TreeItemCheckboxState, TreeItemCollapsibleState, Uri, workspace } from "vscode"

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
 * The data structure for the event fired when the selection changes.
 */
export interface SelectionChangeEvent {
    filesCharCount: number
}
