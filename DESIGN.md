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

# Grasp workspace design

The current workspace uses the Quiet Star Chart palette above: navy and charcoal surfaces, pale teal for actions and source focus, and gold only for mastered concepts. Local system fonts and Lucide icons keep the interface consistent without remote assets.

## Layout and hierarchy

A compact top bar contains identity, Document/Knowledge view selection, new conversation and settings. The document scene fills the workspace; a reading thread and question composer occupy the lower central region. The form is approximately 610px wide on desktop and fills the available width with side margins on narrow screens.

Document View uses retained Three.js CSS3D objects. Cards carry actual PDF first-page thumbnails or extracted text. Documents keep their slots across ordinary chat updates; inspection pauses the orbit and brings the selected source forward. Below 1000px, and for more than twelve documents, a scrollable DOM strip keeps sources readable. With a conversation visible, constrained screens use compact source identities so paper previews do not overlap the answer.

Knowledge View keeps the existing force-directed graph mounted while switching views. Referenced nodes use backend-provided IDs; selected-document nodes are derived from their document membership. Dim, teal and gold distinguish unexplored, learning and mastered concepts. A labelled concept selector provides keyboard access. Hidden graph rendering pauses; force positions are never stored in the backend.

## Composer and processing

The first-run form invites file or folder import. Files stay on the same page. The composer contracts into a processing loop and shows actual ingestion messages, filenames and source-batch counts when provided. No whole-document percentage or fake typing animation is used. Completed documents arrive in their assigned scene slot; narrow and reduced-motion views use an immediate handoff. Duplicate uploads select their existing card. Batch imports share one processing interface, retain independent outcomes and preserve the conversation.

The user's question appears immediately, followed by a pending assistant state. Generated answers appear as complete responses because the API does not stream tokens. Citations name the source and page. Changing retrieval scope requires an explicit Ask this document action; merely inspecting a source does not change scope.

## Inspector and secondary tools

The document inspector occupies a right-hand region on desktop and becomes a full-height sheet on mobile. It shows source identity, actual metadata, original PDF page navigation and exact extracted passages. Text highlights are applied only to matching extracted quote strings, not invented PDF bounding boxes. Mobile background controls become inert and focus is contained; closing restores the opener after the background becomes interactive.

Settings retain saved conversations, source replacement/re-indexing/removal and mastery quizzes. Failed processing keeps its filename and offers retry/dismissal. Missing originals or thumbnail tools use readable source-text fallbacks.

## Interaction and motion

Icon-only actions use shared Lucide controls with accessible names and custom hover/focus tooltips. Focus uses the teal outline. Motion is slow and purposeful: orbit movement pauses during interaction and when the page is hidden. Reduced-motion preference removes nonessential transitions. Preview resources, object URLs and observers are released on removal or unmount.

The separate design-state viewer at /design-preview.html is labelled sample content. It is not the live ingestion interface. Historical phase documents describe earlier checkpoints. Current implementation and verification limits are recorded in docs/redesign/delivery.md.
