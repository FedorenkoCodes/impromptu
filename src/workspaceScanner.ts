import { FileType, Uri, workspace, window } from "vscode"

import { FileFilter } from "./fileFilter"

/**
 * Recursively scans a directory, respecting ignore rules, and populates a cache map.
 * @param dirUri The directory to start scanning from.
 * @param workspaceRoot The root of the workspace.
 * @param filter The file filter instance.
 * @param cache The map to populate with directory-to-descendants mapping.
 * @returns A promise that resolves with an array of all descendant file URIs found under dirUri.
 */
async function scanDirectory(
    dirUri: Uri,
    workspaceRoot: Uri,
    filter: FileFilter,
    cache: Map<string, Uri[]>
): Promise<Uri[]> {
    // Base case: Don't scan ignored directories. The root is never ignored.
    if (dirUri !== workspaceRoot && filter.shouldIgnore(dirUri)) {
        return []
    }

    let descendantFiles: Uri[] = []
    try {
        const entries = await workspace.fs.readDirectory(dirUri)
        for (const [name, type] of entries) {
            const entryUri = Uri.joinPath(dirUri, name)

            if (filter.shouldIgnore(entryUri)) {
                continue
            }

            if (type === FileType.Directory) {
                // Recursively scan subdirectory and add its files to the current list
                const subDirFiles = await scanDirectory(entryUri, workspaceRoot, filter, cache)
                descendantFiles.push(...subDirFiles)
            } else if (type === FileType.File) {
                descendantFiles.push(entryUri)
            }
        }
    } catch (err: any) {
        window.showErrorMessage(`Impromptu: Error scanning directory for cache: ${err.message}`)
    }

    // Store the collected list of files for the current directory
    cache.set(dirUri.toString(), descendantFiles)
    return descendantFiles
}

/**
 * Scans the entire workspace to build a cache of all non-ignored files,
 * organized by their parent directory.
 * @param workspaceRoot The root URI of the workspace.
 * @param filter The file filter to use for ignoring files/folders.
 * @returns A promise that resolves with the populated cache map.
 */
export async function buildFileCache(workspaceRoot: Uri, filter: FileFilter): Promise<Map<string, Uri[]>> {
    const cache: Map<string, Uri[]> = new Map()
    if (workspaceRoot) {
        await scanDirectory(workspaceRoot, workspaceRoot, filter, cache)
    }
    console.log("Impromptu: File cache built.")
    return cache
}
