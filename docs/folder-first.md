# Folder-first workspace

The landing headline is “drop folder to get started”. Importing a folder opens the 3D workspace and makes document Q&A the primary panel. Existing notes are retained and available through Continue.

## Run and try it

Run `python scripts/dev.py --setup` from the repository, then open http://127.0.0.1:5173. On later runs use `python scripts/dev.py`.

Choose a folder with PDF, Markdown or UTF-8 text notes. Nested folders are traversed, including directory entries returned in multiple browser batches. Choose files is the fallback when folder selection is unavailable. Unsupported files are skipped; a folder without supported notes produces a message.

Each supported file gets a waiting, processing, ready or failure state. One failed file does not prevent other files from processing. Unreadable directory entries are reported while readable siblings continue. Failed uploads stay visible and can be retried. For directory-access failures, choose the folder again.

Document roots are transient canvas nodes linked to the persistent extracted concepts. Shared concepts bridge their source documents. Visible document labels track projected graph positions. Clicking a document opens its source passages; clicking a concept opens the passages behind that concept. Canvas positions are not stored.

Q&A defaults to all documents. Search in can limit retrieval to a single document. Citation buttons open exact quotes and Back to answer restores the retained response. The server applies the document filter during vector retrieval, before generating the answer. Quizzes remain a secondary tool.

## Verification

`python scripts/check.py` runs 52 backend tests, five folder traversal tests using Node's built-in runner, and strict TypeScript checks. `npm run build` creates the production bundle. No dependencies were added.

Browser verification used an isolated local library so the user's existing notes were not modified. The native folder chooser imported two original test notes, including one nested file. Both became ready, with shared concepts and named document nodes. A question scoped to review.md returned a citation only from that document. The 390px layout showed Q&A first, retained Add folder and had no horizontal document overflow. Native operating-system drag gestures were not automated; the same recursive traversal used by drops has unit coverage.

The two independent Impeccable reviews covered design and source/error evidence. Their original findings were corrected and reviewed again: processing feedback, citation return, persistent document labels, mobile Q&A priority, keyboard focus, folder availability, partial failures and source selection. The detector ran once, with one advisory on inactive historical canvas styles. No visual overlay is claimed. Questions skipped: the user specified the headline, progression and Q&A priority and requested implementation.

## Still missing

- Real-provider evaluation: mock mode returns retrieved excerpts. Live answer quality, retrieval relevance and reliable abstention on unsupported questions need evaluation.
- Conversation history: questions are independent; follow-up context and saved conversations are not implemented.
- Source management: deletion, replacement/re-indexing, duplicate-file detection and PDF-page previews are not implemented.
- OCR: scanned PDFs still require text extraction outside this app.
- Deployment: authentication, production limits, rate limiting and hosting remain part of the shipping work.

Folder APIs vary by browser. Directory paths are used for import feedback, but the API currently stores the source filename rather than a full folder hierarchy. Graph document links show source membership; they do not claim a causal or semantic relationship between every linked document.
