---
name: Grasp
description: A calm scientific workspace for studying the connections in source notes.
colors:
  background: "#0b1119"
  surface: "#101923"
  raised: "#17232e"
  line: "#263642"
  text: "#e7edf1"
  secondary: "#a4b3bf"
  quiet: "#8194a3"
  accent: "#8ddbcf"
  accent-ink: "#0b2522"
  mastered: "#d9b66f"
  error: "#f0aba6"
  primary-hover: "#b1e9e0"
  secondary-hover: "#21313d"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "30px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  source-heading:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "23px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  status-heading:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "21px"
    fontWeight: 500
    letterSpacing: "-0.02em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 500
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "15px"
    lineHeight: 1.75
  supporting:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    lineHeight: 1.75
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
  small:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "11px"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace"
    fontSize: "11px"
    lineHeight: 1.7
rounded:
  control: "8px"
  action: "9px"
spacing:
  tight: "4px"
  small: "8px"
  compact: "12px"
  medium: "16px"
  reading: "24px"
  canvas: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.action}"
    padding: "0 17px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 13px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    typography: "{typography.label}"
  button-text-hover:
    textColor: "{colors.accent}"
  navigation:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
  navigation-active:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
  document-item:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    rounded: "{rounded.action}"
    padding: "13px 8px"
    width: "100%"
  document-item-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
  schema-select:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    width: "100%"
---

# Grasp design system

## Shared whiteboard

GRASP 2.0 uses a warm charcoal technical whiteboard for both workspaces. The canvas fills the viewport. The workspace switcher and task controls float at the top, and editing and camera controls sit along the bottom. Keep open space around the work and use a faint dot grid for orientation. The frontmatter describes the earlier study surfaces. The recorded showcase retains its existing [surface brief](.impeccable/surfaces/showcase.md).

### Shape

**Knowledge Canvas** serves students in Operate mode. The empty board offers source import and, in offline mock mode, a sample. Document-led bands anchor the generated concepts, with a separate area for concepts shared across sources. At overview scale, document labels and primary concepts lead. Zoom or select an object to see more detail. The searchable outline opens and focuses an object. Questions and inspection are temporary panels. The source viewer opens the exact quote and its page.

**Engineering Canvas** serves the presenter and interviewer in Experience mode. It opens on the architecture overview. Follow two paths across the board, from document input to indexing and from a question to a citation. Inspection reveals descriptions, repository references and demonstrations when available. Presentation mode recedes to the camera and exit controls. The diagram, headings, regions and notes share the same world coordinates.

Success is finding a source or explaining one data path with the surrounding board still in view. The shape assumes a desktop-first editor and a projector-ready audience view. On narrow screens, keep a usable board and an outline. Bring one inspector or composer forward as a focused sheet with a back action. Test actual card density and readable zoom levels in Phase 1.

### Color, text and structure

| Role | Dark | Light for projection |
| --- | --- | --- |
| Canvas | `#191714` | `#f5f0e7` |
| Card | `#24211d` | `#faf5eb` |
| Panel | `#211e1a` | `#fffbf3` |
| Raised control | `#302a24` | `#eae0d2` |
| Text and illustration ink | `#eeeae1` | `#2c251e` |
| Secondary text | `#beb4a7` | `#62564a` |
| Quiet border | `#403c35` | `#d2c5b4` |
| Input boundary | `#7b7064` | `#8a7b6e` |
| Focus and primary actions | `#e0bc99` | `#805032` |
| Data flow and evidence | `#91b88a` | `#386742` |
| Processing | `#e8634b` | `#a63d2c` |
| Annotation ink | `#d8c3ac` | `#76563e` |
| Mastery | `#d9b66f` | `#7b541c` |
| Error | `#f5a79b` | `#a23532` |

Quiet borders and dots provide structure. Input and focus boundaries need at least 3:1 contrast against adjacent fills. Keep normal text at 4.5:1 or higher. Use arrowheads and verbs for direction, gentle curves for annotations and dashed connectors for document adjacency. Show full relationship labels and endpoints in the inspector. Gold belongs to mastered concepts.

Use Source Serif 4 for board headings, primary concepts and diagram captions. Use the system sans-serif for controls and descriptions, and monospace for source paths. Caveat marks authored annotations. Both display faces ship locally with their [Caveat OFL](apps/web/public/fonts/Caveat-OFL.txt) and [Source Serif 4 OFL](apps/web/public/fonts/SourceSerif4-OFL.txt) notices. Preserve readable text in the inspector at every zoom level.

### Technical objects and annotations

- Draw with the shared 74 × 64 SVG coordinate space, 1.65-unit strokes and rounded line ends. Start with a distinct silhouette. Add one accent to clarify a technical feature such as overlap, a source span or a query neighbour.
- Use unboxed figures for artefacts such as pages, chunks and databases. Use captioned processing cards for actions such as embedding or validation. Leave headings and text on the board itself. Use a quiet outlined region for a subsystem.
- Render notes in handwriting with optional underline or callout treatments. Use curved arrows and an inspectable relation label when a note points to an object. Keep formal captions in serif or sans-serif. Evidence objects show their real source name, page and exact text.
- For diagrams that accept data, place the visual object on the board and put accessible interactive controls in its inspector. Declare illustrative examples where the values appear. Bind future interactions to checked source records and traces when those are available.

### Interactions and states

| State or action | Feedback and controls |
| --- | --- |
| Empty, loading or importing | Show a single primary import action or the first available frame. Keep real progress, waiting and errors tied to the corresponding source. Label local mock and recorded replay where the viewer can see the mode. |
| Pan and zoom | Space-drag and middle-drag pan. Trackpad two-finger movement pans, pinch zooms at the gesture point, and mouse wheel zooms at the cursor when the board owns the event. Keep Fit board, Fit selection and zoom buttons reachable by keyboard. Scroll inside source and text fields without moving the board. |
| Select and edit | Single-click focuses the card, Shift adds to selection and an empty-canvas marquee selects multiple. Selection has an outline, optional resize handles and a short action menu. Edits use explicit text focus and can cancel with Escape. An accessible outline exposes the same target and actions. |
| Routes and pointers | The board shows the whole relation route with labels where readable. Select an edge to reveal its full label and provenance. Context actions work with the keyboard as well as a pointer. Search, focus and opening evidence preserve navigation context. |
| Failure, stale or unsupported | Provide an actionable message by the affected object or operation. Keep the quote visible if an original PDF preview is unavailable. A failed board save preserves the draft. Unsupported Q&A leaves the user able to change scope or inspect sources. |
| Camera and presentation | Camera moves orient the audience and settle before reading. Start with 280–420 ms for a frame hop and 120–160 ms for small state feedback. Cancel on direct gesture, jump under reduced motion, and keep tabs and stroke samples free of ambient animation. |
| Narrow and projected | On phones prioritize board navigation, source reading and questions. Provide keyboard/focus alternatives to precision gestures. On projectors increase evidence title and edge label legibility and test at 1280 × 720 and 1920 × 1080. |

The 3D explorer loads on request and respects the same semantic selection. Keep the first canvas load lightweight using local fonts and a deferred 3D bundle. Use original GRASP shapes and wording. See the [reference findings](docs/grasp-v2/references.md) and [acceptance gates](docs/grasp-v2/roadmap.md#acceptance-criteria).
