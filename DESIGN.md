# Design system

## Direction

A quiet study canvas with the depth of a star chart. Navigation and source reading use familiar controls. The canvas has the most room. Branding stays small so a portfolio visitor sees the workspace first.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| background | #0b1119 | Main canvas |
| surface | #101923 | Source panel and navigation |
| raised | #17232e | Hover and selected neutral surfaces |
| line | #263642 | Hairline separators |
| text | #e7edf1 | Primary content |
| secondary | #a4b3bf | Secondary copy |
| quiet | #8194a3 | Supporting text |
| accent | #8ddbcf | Primary actions, selection and learning |
| accentInk | #0b2522 | Text on the accent fill |
| mastered | #d9b66f | Mastered nodes in the later graph phase |
| error | #f0aba6 | Errors |

Use one cool accent. Do not use mastered gold to decorate the preview. Body text must meet WCAG AA contrast against its surface.

## Type

Use a locally available sans-serif stack for app labels and source reading. Use a monospace stack only for measurements, identifiers and code. Body text is 14px with 1.6 line height. Source paragraphs are 15px with 1.75 line height. Headings use a restrained 18/24/30px scale. Letter spacing never falls below -0.03em.

## Layout

The desktop workspace has a 60px top bar, a 224px document rail, a flexible canvas and an optional 360px source panel. Each region has a single purpose. The canvas remains usable when panels collapse. Below 900px, the document rail becomes a compact header row. Below 640px, the source panel takes the main content area while open and provides an explicit back action.

## Controls

Use Lucide icons at 16 or 18px, with visible text on primary actions. Primary buttons have a 10px radius. Secondary controls are quiet text buttons or icon buttons with accessible names. Active tabs use the accent text and a thin underline. Focus uses a 2px accent outline with a 3px offset. Touch targets are at least 44px.

## Motion

Panel transitions last 160ms. The Phase 1 canvas is static; background motion would imply graph behavior that has not been implemented. Later graph motion must be slow, bounded and disabled for reduced-motion users. No page-load choreography.

## Phase 1 truth

The sample reader displays the original note served by the API. The schema inspector displays live Pydantic JSON schemas. Storage indicators are based on the health endpoint. There are no fake uploads, generated answers or mastery results. The star field is a visual background, not graph data.
