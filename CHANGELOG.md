# Change Log

All notable changes to the "impromptu" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/), and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

---

## [0.1.0] - 2025-06-23

### Added

- **Initial Release of Impromptu**
- **Core Prompt Generation:**
    - File tree view with checkboxes to select project files and folders for prompt context.
    - "Generate Prompt" button to create a single, consolidated prompt file.
    - Support for `.prepend.md` and `.append.md` files in the project root for reusable instructions.
- **Interactive UI:**
    - React-based "Actions" view with controls.
    - Option to include an ASCII file tree in the prompt.
    - Option to automatically copy the generated prompt to the clipboard.
    - Text area for adding last-minute, one-off instructions.
    - Real-time character and token estimation counter.
- **VS Code Integration:**
    - Context menu integration to add files directly from the VS Code Explorer or editor tabs.
    - The file tree automatically updates when files are created, deleted, or renamed.
    - State persistence for file selections and UI options is saved per workspace.
- **Configuration & Filtering:**
    - Customizable prompt templates and headers via the standard VS Code Settings UI.
    - Integration with `.gitignore` to automatically filter the file tree.
    - A live toggle button in the view's title bar to enable or disable the `.gitignore` filter.