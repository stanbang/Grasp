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

# Design System: Grasp

## Overview

**Creative North Star: "The Quiet Star Chart"**

Dark navy surfaces and a sparse star field give the study workspace a calm, scientific character. Pale teal draws attention to actions and source links. Small labels and familiar controls keep the canvas prominent.

The interface uses local fonts, CSS geometry and Lucide line icons. Naming stays quiet: the app presents a study space, with little branding. The portfolio preview remains lightweight and makes its current phase clear.

**Key Characteristics:**

- A dark canvas with restrained celestial geometry.
- One cool accent; gold reserved for mastery.
- Flat, bordered panels and readable source passages.

## Colors

The palette combines blue-grey neutrals with pale teal.

### Primary

The accent is pale teal for primary actions, links, connected status and focus outlines. Accent ink gives filled actions dark, readable labels. Primary hover is a lighter teal.

### Neutral

Background is the deepest navy. Surface separates the top bar, source rail, footer and reader from the canvas. Raised marks hover and selection; secondary hover deepens a filled secondary control. Line draws quiet boundaries.

Text is cool white. Secondary carries reading paragraphs and supporting copy; quiet carries metadata and status labels. Use these roles deliberately rather than lowering the opacity of content.

Gold is reserved for mastered concepts. The mastered token is present but unused in Phase 1. Error is a muted warm red for failed requests and configuration messages.

**The One Accent Rule.** Use teal for actions and attention. Reserve gold for mastered concepts.

## Typography

Use the local sans-serif stack for the interface and source reader. The inherited Tailwind monospace stack is used for JSON schemas. Neither needs a font download.

The type ramp is compact and role-specific. Source paragraphs use the body token; it is not a global size for every interface element.

- Display is the canvas invitation. Its desktop size is in the frontmatter; at widths up to (1100px) it becomes (26px), then (28px) at widths up to (640px).
- Source heading uses the source-heading token. Source section headings are (14px), weight (600).
- Panel and document titles use the title token. The rail heading is (13px), weight (550); the workspace name is (14px), weight (500), becoming (13px) on mobile.
- Source paragraphs use body with preserved line breaks. Status and contract explanations use supporting.
- Canvas supporting copy is (13px) with line height (1.8), becoming (12px) on mobile.
- Actions and navigation usually use label; metadata uses label or small. Mobile navigation is (11px) and footer copy is (10px).
- JSON uses code and horizontal scrolling for long lines.

General inherited line height is (1.5). There is no uniform global (14px) body rule and no fixed-ratio heading scale.

## Layout

The workspace fills (100dvh), with a minimum height of (550px), reduced to (520px) on mobile. A top bar (60px) and footer frame a flexible horizontal work area. The footer has a minimum height of (33px); its project link has a minimum height of (44px), so the rendered footer can be taller.

Desktop uses a source rail (224px), a flexible canvas and an optional reader/status panel (360px). The reader body scrolls independently, with (24px) padding. Canvas edge labels sit (28px) from the sides. Spacing uses compact gaps around controls and larger pauses between reading sections.

At widths up to (1100px), the rail becomes (200px) and the side panel (330px). Secondary canvas edge labels disappear while a panel is open. At widths up to (900px), the rail is hidden and a compact Status button appears in the top bar.

At widths up to (640px), the top bar is (57px) high; collection details are hidden. An open panel takes the available work area and hides the canvas. Its close control reads "Back to canvas." At widths up to (380px), the workspace name is hidden while the orbit symbol remains. The supported minimum viewport width is (320px).

## Elevation & Depth

There are no box shadows. Tonal surfaces and single-pixel borders separate regions. The static canvas combines small radial-gradient stars, faint concentric rings and cross axes. These marks provide depth without representing graph data. The rings remain part of the star-chart language; they are not a general container pattern.

## Shapes

Controls have gently rounded corners: the action radius is used for the primary button and document row, and the control radius for navigation, secondary buttons and the selector. Panels remain rectangular and meet their neighbours at straight borders.

The canvas orbit symbol has a rounded square enclosure (70px square, 22px radius). The file symbol is (32px by 38px, 7px radius). Small status dots are circular. These distinctive symbols do not establish a general card style.

## Components

### Buttons

Primary actions use a teal fill, dark ink, a label at weight (600), and a height of (44px). Secondary actions use a raised neutral fill and a single-pixel line border. Text actions use secondary text and turn teal on hover. Secondary and text actions have a minimum height of (44px).

Buttons, links and selects transition background colour and text colour over (160ms), with the browser's default ease timing. Disabled buttons use opacity (0.6) and a wait cursor. Focus-visible controls and the scrollable schema receive a teal outline (2px) with an offset of (3px). Reduced-motion preference removes transitions.

### Navigation and document row

Navigation uses compact icon-and-text buttons. Hover and active states share a raised background and primary text; there is no active underline. The source row uses a raised background on hover or selection and primary text when selected. Its title and file metadata remain separate in size and colour.

### Source, contracts and status panels

Only one panel is open at a time. Panels mount and unmount immediately; there is no sliding or panel transition. Opening a panel focuses its heading. Closing it with the back/close button or Escape restores focus to the original opener.

The source reader presents the original API sample and a Markdown download. The contracts panel has a native selector with a raised fill, line border and minimum height of (44px), followed by a focusable, scrollable JSON block. There is no text-input or chip pattern in the current preview.

Status uses simple divided rows. Loading shows static raised placeholder lines. Request failures use the error colour with a retry action. Health and configuration copy come from the running API.

### Canvas

The canvas has a centred invitation, a primary sample action and a quiet contracts action. Its stars, rings and axes remain static. Real graph nodes, camera controls and force motion are outside Phase 1. Future motion should stay slow and purposeful and respect reduced-motion preferences.

## Do's and Don'ts

### Do:

- Do keep the canvas visually prominent and naming quiet.
- Do use teal for actions, source links, focus and connected status.
- Do keep source paragraphs at the body reading size on narrow screens.
- Do preserve visible keyboard focus and the explicit mobile back action.
- Do distinguish source content, live API status and preview decoration.

### Don't:

- Don't use gold for decoration or ordinary activity.
- Don't turn the workspace into a generic grid of metric cards.
- Don't animate the Phase 1 star field or imply that it contains graph data.
- Don't add remote font or image dependencies to the lightweight preview.
