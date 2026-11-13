# Demo script

Start with `python scripts/dev.py`. Keep the footer visible so visitors can distinguish offline fixtures from the live provider.

1. Open the landing page. Drop `samples/memory-and-learning.md`, or use Choose a file. The URL stays the same; the question box appears while the map fills in.
2. Ask “What is retrieval practice?” Open a citation, read its exact quote, expand the extracted page, then close the dialog.
3. Ask “Explain that more simply.” In live mode, compare the generated explanation with its evidence. Offline mode returns source excerpts.
4. Add `samples/retrieval-review.md`. Shared concepts merge into the existing map. Orbit and zoom the map outside the question card.
5. Ask an unsupported question, such as “Who won the intergalactic pickleball championship?” The answer should acknowledge the missing evidence.
6. Open Workspace options. Open Check understanding, choose a concept and answer all three questions. At least two correct answers mark that concept mastered.
7. Refresh. Open the saved conversation through Workspace options. Source records, answers and mastery remain stored.

For PDF source previews, upload a text PDF and click an answer citation. For scanned PDFs use `OCR_ENABLED=1` with the container or installed native tools. OCR quality depends on the scan; citations preserve the recognized page text.

For a portfolio recording, use only the original samples or documents you may share. Avoid showing `.env`, private notes or API keys.
