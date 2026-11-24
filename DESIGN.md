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

## Canvas direction for review

GRASP 2.0 uses a quiet technical whiteboard as the shared workspace. The dark navy, cool white and teal palette carries forward the star-chart character. A sparse grid, open space and legible relationships make room for the user's work. The existing recorded showcase retains its own [surface brief](.impeccable/surfaces/showcase.md).

### Shape

**Knowledge Canvas** serves students in Operate mode. Its first view has a compact workspace switcher and a broad usable board. The empty board offers Add documents and a public sample. A populated board opens at a readable overview of document groups and representative concepts. Search opens an outline or focuses a result. Import feedback sits by its document. The right inspector opens from a card, question or citation. The question composer occupies the inspector or a compact focused tray. A source quote can be opened and closed without losing the selected concept.

**Engineering Canvas** serves the presenter and interviewer in Experience mode. It opens on the architecture overview with a small frame navigator. The eye follows labeled arrows across a short chain. On inspection, the card reveals one explanation, the inputs and outputs, then exact code and evidence references. Presentation mode removes editing tools, gives the diagram more canvas, and reserves room for frame controls. A jump into Knowledge retains the presentation return point. Presenter notes have their own view.

Success is finding a source or explaining one data path with the surrounding board still in view. The shape assumes a desktop-first editor and a projector-ready audience view. On narrow screens, keep a usable board and an outline. Bring one inspector or composer forward as a focused sheet with a back action. Test actual card density and readable zoom levels in Phase 1.

### Color, text and structure

| Role | Dark | Light for projection |
| --- | --- | --- |
| Canvas | `#0b1119` | `#f1f4f4` |
| Card and panel | `#101923` | `#ffffff` |
| Raised control | `#17232e` | `#e5ecee` |
| Text | `#e7edf1` | `#17242c` |
| Secondary text | `#a4b3bf` | `#485b65` |
| Structure | `#263642` | `#c2cfd3` |
| Focus, active action and link | `#8ddbcf` | `#00685d` |
| Mastery | `#d9b66f` | `#7b541c` |
| Error | `#f0aba6` | `#a23532` |

Dark tokens in the frontmatter describe the existing system. The light roles and canvas rules are proposed. Verify contrast on assembled components, including focus outlines against adjacent fills, with the Phase 1 build. Decorative lines use the quiet structure role. Interactive boundaries must remain legible at 3:1. Gold belongs to mastered concepts. Error red and symbols identify failures. Labels and icons carry meaning alongside color.

Use the system sans-serif stack. Use the local monospace stack for code paths and IDs in the inspector. Aim for 16–18 px card titles, 13–14 px connector/metadata labels at the normal camera zoom, 15–16 px reading text and 28–34 px presentation headings at target projector framing. At distant zoom, show titles or groups. In the inspector, keep the full body and relationship text available regardless of canvas zoom.

Use 8 px control corners, calm one-pixel card borders, 12–16 px card insets and at least 24 px between unrelated clusters. Regions use a quiet outline and a visible heading. Architecture components use function icons and input/output labels. Documents have a file icon and status. Concepts have a concept label and mastery marker when present. Notes use a distinct shape and authored label. Evidence has a quote mark, document title and page. Use dark or light neutrals for structure, with a teal focus outline and matching controls.

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
