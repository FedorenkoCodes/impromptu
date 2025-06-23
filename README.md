# Impromptu ⚡ Stop copy-pasting. Start generating perfect prompts from your code.

Stop manually copy-pasting code into LLMs. **Impromptu** is a powerful VS Code extension designed to help you effortlessly build large, context-aware prompts for any AI model (like GPT-4, Gemini, Claude, and more) directly from your workspace files.

Providing the right context is the key to getting great results from AI. Impromptu makes it trivially easy to select files and folders, include your project structure, and wrap it all with your custom instructions into a single, perfect prompt file.

<img src="https://github.com/user-attachments/assets/418d5652-5b7b-486c-a0cb-49929dfcd01e" width="100%" />

## Core Features

  * **⚡ Dynamic & Interactive File Tree:** A custom tree view in the sidebar with checkboxes that automatically updates when you create, delete, or rename files.
  * **🖱️ Multiple Ways to Select:**
      * Check files and folders directly in the Impromptu file tree.
      * Use the **"Select All"** and **"Clear Selection"** buttons for bulk actions.
      * Right-click on any file/folder in the VS Code Explorer or on an editor tab and choose **"Add to Impromptu Prompt"**.
  * **📋 Rich & Intelligent UI:**
      * A main **"Generate Prompt"** button to kick things off.
      * A **"Copy"** checkbox to automatically send the generated prompt to your clipboard.
      * An **"ASCII paths"** checkbox to include a file structure tree in the prompt.
      * A text area for adding last-minute, one-off instructions to the end of the prompt.
      * A dynamic character and token-estimation counter that updates in real-time.
  * **⚙️ Fully Configurable Engine:**
      * Use special `.prepend.md` and `.append.md` files in your project root for reusable instructions.
      * Customize all prompt templates and headers directly in VS Code settings.
  * **👁️ Dynamic `.gitignore` Filter:**
      * Automatically respects rules from your project's `.gitignore` file.
      * A dedicated toggle button in the view's title bar lets you instantly enable or disable the `.gitignore` filter. Your choice is saved per-workspace.
  * **💾 Persistent State:** Your file selections, UI checkbox states, and additional instructions are all remembered across sessions for each workspace.

## How to Use

1.  Click the new **Impromptu icon** in the Activity Bar to open the views.
2.  In the **"Project Files"** view, use the checkboxes to select the files and folders you want to include.
3.  In the **"Actions"** view:
      * Check **"Copy"** to copy the final prompt to your clipboard.
      * Check **"ASCII paths"** to include a tree of your selected file paths.
      * Type any final, one-off instructions into the text area.
4.  Click the **"Generate Prompt"** button.
5.  A new file `impromptu_prompt_...md` will be created and opened.
6.  Paste the result into your favorite LLM and get better, more context-aware answers\!

## Special Files

For instructions that you reuse often, you can create special files in the root of your workspace:

  * `.prepend.md`: The content of this file is always added to the **very beginning** of your prompt. Perfect for system prompts or global instructions.
  * `.append.md`: The content of this file is always added to the **very end** of your prompt (but before any text from the "additional instructions" text area).

Use the buttons in the "Actions" view to create and open these files quickly.

## Extension Settings

Customize Impromptu's behavior by navigating to `File > Preferences > Settings` and searching for "Impromptu".

  * **`impromptu.projectStructureHeader`**

      * The header text to display above the ASCII project structure tree.
      * Default: `--- Project Structure ---`

  * **`impromptu.startOfFilesHeader`**

      * Optional header text to insert before the content of the first selected file.
      * Default: `--- Start of Files ---`

  * **`impromptu.fileContentTemplate`**

      * The template used to wrap each selected file's content. Use `{filePath}` and `{fileContent}` as placeholders.
      * Default:
        ```
        --- Start of {filePath} ---

        {fileContent}

        --- End of {filePath} ---
        ```

## For Developers (Contributing)

We welcome contributions\! If you're interested in helping improve Impromptu, please feel free to open an issue or submit a pull request on our [GitHub repository](https://www.google.com/search?q=https://github.com/your-username/impromptu).

### Local Development

1.  Clone the repository.
2.  Run `yarn install` to install all dependencies.
3.  Run `yarn watch` to start the webpack bundler in watch mode for both the extension and the webview.
4.  Press `F5` in VS Code to open a new Extension Development Host window with the extension running.

The project is split into two main parts:

  * `src/`: The main extension backend (TypeScript, Node.js).
  * `web/`: The frontend UI for the "Actions" view (React, TypeScript).

-----

This extension is licensed under the MIT License.
