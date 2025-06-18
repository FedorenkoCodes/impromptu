import * as vscode from 'vscode';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs'; // Use promises for async file operations
import * as path from 'path';

/**
 * Gets the URI of the first workspace folder.
 * @returns The URI of the workspace folder, or undefined if no workspace is open.
 */
export function getWorkspaceUri(): vscode.Uri | undefined {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        return vscode.workspace.workspaceFolders[0].uri;
    }
    return undefined;
}

/**
 * Ensures a file exists at the given URI. If it doesn't, it creates it with initial content.
 * @param fileUri The URI of the file to check/create.
 * @param initialContent The content to write if the file needs to be created.
 */
export async function ensureFileExists(fileUri: vscode.Uri, initialContent: string = ''): Promise<void> {
    try {
        await fsPromises.access(fileUri.fsPath); // Check if file exists
    } catch (error: any) {
        if (error.code === 'ENOENT') { // File does not exist
            await fsPromises.writeFile(fileUri.fsPath, initialContent, 'utf8');
            console.log(`Created file: ${fileUri.fsPath}`);
        } else {
            throw error; // Re-throw other errors
        }
    }
}

/**
 * Reads the content of a file.
 * @param fileUri The URI of the file to read.
 * @returns A promise that resolves with the file content as a string.
 */
export async function readFileContent(fileUri: vscode.Uri): Promise<string> {
    try {
        const content = await fsPromises.readFile(fileUri.fsPath, 'utf8');
        return content;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            vscode.window.showWarningMessage(`Impromptu: File not found: ${fileUri.fsPath}`);
            return ''; // Return empty string if file doesn't exist
        }
        throw new Error(`Error reading file ${fileUri.fsPath}: ${error.message}`);
    }
}

/**
 * Writes content to a file.
 * @param fileUri The URI of the file to write to.
 * @param content The string content to write.
 */
export async function writeFileContent(fileUri: vscode.Uri, content: string): Promise<void> {
    try {
        await fsPromises.writeFile(fileUri.fsPath, content, 'utf8');
    } catch (error: any) {
        throw new Error(`Error writing to file ${fileUri.fsPath}: ${error.message}`);
    }
}