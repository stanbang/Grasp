# Phase 6 completion

All six implementation phases are complete. The final main screen is a same-page file drop followed by a question box over the interactive map. Source inspection, management, saved conversations and quizzes open only through explicit actions.

## Files changed

The API adds conversations, contextual retrieval, document lifecycle and duplicate detection, durable removal cleanup, owner-token access, request limits, native OCR and a production ASGI mount. Generated frontend contracts mirror the new request shapes. The web app adds authenticated fetch/SSE, a quiet map background, the composer and source/options dialogs. Evaluation cases, repeatable provider/OCR checks, Docker files and deployment/demo documentation are included.

## Run and verify

Run `python scripts/dev.py --setup` and open http://127.0.0.1:5173. Drop a PDF, Markdown or TXT file. The page must stay in place, show “what question would you like to ask” and wait for a readable source before submitting. Ask a question, inspect a citation and ask a follow-up. Workspace options contains quizzes and source management. See [the demo script](demo.md).

Run `python scripts/check.py` and `npm run build` for regression checks and the production bundle. The completed run passed 68 backend tests, seven Node file-drop/traversal tests and strict TypeScript. Contract generation matches Pydantic. The 3D engine remains a separate lazy bundle; Vite warns about its size. LangChain Community emits a deprecation warning, but remains in the explicitly fixed stack.

The live check used Gemini 3.1 Flash Lite with gemini-embedding-001: extraction produced seven concepts, two answers had exact citations, follow-up turns persisted, an unrelated question abstained and three generated quiz questions graded successfully. The results are in [live-verification.json](live-verification.json). The check is reproducible with the virtual-environment Python and `scripts/verify_live.py`; it uses a temporary library and makes provider requests.

The original 20-case retrieval evaluation reports mock Hit@5 1.000 / MRR 0.950 and Gemini embedding Hit@5 1.000 / MRR 0.875. Reports include expected and returned chunk IDs in [evaluation.json](evaluation.json) and [evaluation-live.json](evaluation-live.json). There are only three chunks, so Hit@5 checks the pipeline rather than broad semantic relevance. These results do not establish general answer quality.

The Linux Docker image built and its same-origin API reached healthy status. A genuine image-only PDF was rendered and uploaded through the production API. Native Poppler/Tesseract recognized its text, and every stored chunk matched its page offsets; see [ocr-verification.json](ocr-verification.json). The fixture script is `scripts/verify_ocr.py`. The final persistent container also passed the combined native-OCR/Gemini ingestion check, returned an exact cited answer from that scan and served its original PDF inline. See [production-verification.json](production-verification.json).

## Design review

Impeccable shape preserved the existing dark star-chart direction. Independent design and evidence reviewers checked the requested surface. The polish pass fixed stale conversation responses, submit guards during initial ingestion, empty failed-import scope, source scope after management actions, first-question loading feedback and draft preservation. Follow-up review cleared the original findings. Audit also led to durable native-store/file cleanup retries. The detector ran once and returned no findings; it was not rerun after those fixes.

Browser checks exercised the landing page, same-page chooser import, first-question loading, a generated Gemini answer, inline exact source quotes and the options dialog. The OS drag gesture itself was not automated; prevention of native file navigation is covered by the seven Node tests. The original concepts and source interfaces remain available through explicit dialogs, with no persistent lists on the main surface. A node click opened its summary and exact source passages. A 390-pixel iframe check showed the cited-answer/composer layout without horizontal overflow (body width and scroll width were both 390); a temporary browser viewport override did not apply, so the iframe provided the narrow-layout evidence.

## Limits

This is a single-owner, single-worker local app with a self-hosting recipe. No public host or HTTPS deployment is configured. The owner token does not provide separate user accounts. OCR citations are exact to recognized text and may contain recognition errors. English OCR is bundled; other language packs are not. Live requests depend on provider availability and quota. The older Gemini model rejected this account and the recommended larger replacement timed out; the configured Flash Lite model passed the checks.

Exact substring validation verifies evidence provenance, not every factual inference made by an LLM. The small sample evaluation and one live quiz are acceptance checks, not an educational study. Provider keys, uploads and local databases remain ignored by Git.
