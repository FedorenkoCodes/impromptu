import * as path from "path"
import { Uri, workspace } from "vscode"

/**
 * A recursive function to build a tree structure from path components.
 * @param tree The tree object to populate.
 * @param parts The parts of the file path.
 */
function buildTree(tree: any, parts: string[]) {
    const [first, ...rest] = parts
    if (!first) {
        return
    }

    if (!tree[first]) {
        tree[first] = {}
    }

    if (rest.length > 0) {
        buildTree(tree[first], rest)
    }
}

/**
 * A recursive function to render the tree structure into an ASCII string.
 * @param node The current node of the tree to render.
 * @param prefix The string prefix for the current line.
 * @returns The rendered ASCII string for the node.
 */
function renderTree(node: any, prefix: string = ""): string {
    let result = ""
    const keys = Object.keys(node).sort((a, b) => {
        // Sort so that folders (nodes with children) come before files (empty nodes)
        const aIsFile = Object.keys(node[a]).length === 0
        const bIsFile = Object.keys(node[b]).length === 0
        if (aIsFile === bIsFile) {
            return a.localeCompare(b) // Alphabetical sort for same types
        }
        return aIsFile ? 1 : -1 // Folders first
    })

    keys.forEach((key, index) => {
        const isLast = index === keys.length - 1
        const connector = isLast ? "└─" : "├─"
        const newPrefix = isLast ? "  " : "│ "
        const entryIsFile = Object.keys(node[key]).length === 0

        result += `${prefix}${connector} ${key}\n`

        if (!entryIsFile) {
            result += renderTree(node[key], prefix + newPrefix)
        }
    })

    return result
}

/**
 * Generates an ASCII tree representation of the selected files and their directory structure.
 * @param selectedFileUris The URIs of the selected files.
 * @param workspaceRoot The root URI of the workspace.
 * @returns A string containing the formatted ASCII tree.
 */
export function generateAsciiTree(selectedFileUris: Uri[], workspaceRoot: Uri): string {
    const fileTree = {}

    // Create a set of all directories that need to be included
    const requiredDirs = new Set<string>()
    const relativeFilePaths = selectedFileUris.map((uri) => {
        const relativePath = workspace.asRelativePath(uri, false)
        // Add all parent directories of the file to the set
        let currentPath = path.dirname(relativePath)
        while (currentPath !== "." && currentPath !== "/") {
            requiredDirs.add(currentPath)
            currentPath = path.dirname(currentPath)
        }
        return relativePath
    })

    // Combine directories and files into one list to build the tree
    const allPaths = [...Array.from(requiredDirs), ...relativeFilePaths]

    // Build the hierarchical tree object
    for (const p of allPaths) {
        buildTree(fileTree, p.split(path.sep))
    }

    // Render the tree, starting with the workspace folder name
    const rootName = path.basename(workspaceRoot.fsPath)
    return `${rootName}/\n` + renderTree(fileTree)
}
