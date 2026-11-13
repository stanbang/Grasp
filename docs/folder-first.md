# Same-page import

The opening headline is “drop folder to get started”. Dropping a file or folder reveals the question box over the 3D mindmap without navigation, a new window or a picker. A picker opens only after an explicit Choose a file or Choose folder action.

Nested directories are traversed across all browser entry batches. Readable siblings continue when an entry fails. Supported extensions are PDF, Markdown and TXT. The composer waits until at least one source is ready; a completely failed import cannot query unrelated older notes.

The main screen contains the map, question box and conversation. There are no source lists or connected-ideas panels. The question label is “what question would you like to ask”. Citation buttons open a source dialog, including an inline original PDF when available. Workspace options holds source management, saved conversations and quizzes.

New imports start a conversation scoped to successful sources. Additional imports retain the stored graph, allowing shared concepts to connect documents. New conversation resets the source scope to the workspace. Graph positions stay in the browser.

Run `python scripts/dev.py`, then open http://127.0.0.1:5173. The seven Node tests in `scripts/tests/folder-upload.test.cjs` cover recursive import, partial failures, preventing native file navigation and leaving ordinary text drops alone. OS drag gestures are not automated; browser verification uses the file chooser and the same importer.

Folder APIs vary by browser. The API stores source filenames rather than a full folder hierarchy. See [Phase 6](phase-6.md) for current verification and [the demo](demo.md) for a short walkthrough.
