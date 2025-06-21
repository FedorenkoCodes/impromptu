import { Uri, workspace } from "vscode"
import { TextDecoder } from 'util'
import ignore, { Ignore } from "ignore"
import * as path from "path"

/**
 * A class to handle file and directory filtering based on a combination of
 * hardcoded rules and rules from a .gitignore file.
 */
export class FileFilter {
    private ig: Ignore = ignore()
    private workspaceRoot: Uri

    // A single place for all hardcoded ignore rules.
    // These patterns are in .gitignore format.
    private static readonly defaultIgnores = [
        // Common dev/OS files
        ".git",
        ".vscode",
        ".DS_Store",
        "node_modules",
        "*.log",

        // Common binary/unwanted file types
        "*.jpeg",
        "*.ico",
        "*.png",
        "*.svg",
        "*.gif",

        // Impromptu-specific files to always ignore
        ".prepend.md",
        ".append.md",
        "impromptu_prompt_*.md",
    ]

    constructor(workspaceRoot: Uri) {
        this.workspaceRoot = workspaceRoot
        // Add the default, hardcoded rules.
        this.ig.add(FileFilter.defaultIgnores)
    }

    /**
     * Asynchronously reads the .gitignore file from the workspace root
     * and adds its rules to the filter.
     */
    public async initialize(): Promise<void> {
        try {
            const gitignoreUri = Uri.joinPath(this.workspaceRoot, ".gitignore")
            const gitignoreContentBytes = await workspace.fs.readFile(gitignoreUri)
            const gitignoreContent = new TextDecoder().decode(gitignoreContentBytes)
            this.ig.add(gitignoreContent)
            console.log("Impromptu: Loaded .gitignore rules.")
        } catch (error) {
            // This is not an error, it just means no .gitignore was found.
            console.log("Impromptu: No .gitignore file found in the workspace root.")
        }
    }

    /**
     * Checks if a given file or folder URI should be ignored.
     * @param uri The URI of the file or folder to check.
     * @returns `true` if the URI should be ignored, `false` otherwise.
     */
    public shouldIgnore(uri: Uri): boolean {
        // The 'ignore' library requires paths relative to the root (.gitignore location).
        const relativePath = path.relative(this.workspaceRoot.fsPath, uri.fsPath)

        // An empty path means it's the root folder itself, which should never be ignored.
        if (relativePath === "") {
            return false
        }

        // The library expects POSIX paths (with '/') even on Windows.
        const posixPath = relativePath.split(path.sep).join(path.posix.sep)

        return this.ig.ignores(posixPath)
    }
}
