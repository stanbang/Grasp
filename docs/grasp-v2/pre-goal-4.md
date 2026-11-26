# Pre-Goal 4 acceptance remediation

Owner acceptance is pending.

## Baseline

The owner token lives in a JavaScript module variable. A refresh or a new tab clears it. The MCP adapter already reads a separate agent credential from the local GRASP settings and survives browser changes. Setup preserves existing credentials. The browser uses the same-origin API proxy, so changing hosts also changes the browser's authentication scope.

A disposable wallet dashboard reproduced the prompt on refresh. Its 16 titles stayed mounted at every tested zoom. The CSS transform shrank a typical title from 16 pixels at normal zoom to 8.8 at intermediate zoom and 2.4 at minimum zoom. All ten connector labels were present at normal zoom. The React component removed all of them at 55% and 15%. The renderer does not enable React Flow viewport culling. The four-line description clamp clipped text at normal zoom.

Project cards use persisted rectangles supplied by the agent or owner. Smooth-step paths and their midpoint labels derive from endpoint handles. They have no knowledge of unrelated rectangles or label occupancy. The existing MCP readback verifies saved graph state. A rendered pass is needed to verify text and route readability.

## Implementation and acceptance

| Area | Change and evidence required |
| --- | --- |
| Workspace access | Exchange the owner token for a browser session in an HTTP-only cookie. Verify restoration across a refresh, new tab, browser relaunch, backend restart and project switch. Verify logout, revocation and recovery. Check that a bearer agent still cannot act as owner. Use fresh desktop and CLI sessions outside the checkout. |
| Card content | Give new agent-generated cards size and placement support. Verify text wrapping, short and long descriptions, resize behavior and access to complete text. Keep manually positioned content stable. |
| Relationships | Route around nearby cards where space permits. Place labels in clear areas and prioritize significant relationships. Verify routes update after edits and remain readable at several zoom levels. |
| Contextual placement | Generate a fresh architecture and expand a selected component. Verify new content stays nearby and connected without displacing earlier objects or replacing owner decisions. |
| Readback | Use live MCP for board reads and writes. Use the rendered browser to check actual text, overlap and labels after the write. Capture any remaining layout limitations. |
| Semantic zoom | Capture normal, intermediate and minimum zoom of the same architecture. Verify group names, readable component identifiers where they fit, prioritized links, and searchable object and connection details. Confirm that returning to normal restores detail and camera changes leave the saved revision unchanged. Check a dense board for responsiveness and fit. |

Run the existing verification and AI Video Editor boards as regressions. Use a fresh application concept for the owner run. Select an object, request a visual explanation, correct a relationship in the canvas, and ask the agent to update its design without restating the correction. Open a fresh chat and recover the same design and decisions. Record the owner run before proceeding to Goal 4.

## Verified implementation

- GRASP issues an opaque, 30-day owner cookie scoped to the workspace host and port. SQLite keeps the session digest. Refresh, a second tab, a Chromium relaunch with the same profile and a backend restart restored access in tests. Workspace options can revoke one session or all sessions. Rotating the owner token invalidates earlier sessions. The bearer agent still has its own permissions.
- The MCP layout option sizes and places new objects from content and group hints. Expansion uses space near its source. An owner resize switches an automatically sized card to manual sizing. Older placements remain on the board. If content exceeds a card, its **Full text** control opens the inspector.
- The Project canvas renders readable titles and summaries at medium zoom. At overview zoom it keeps section names, displays titles where the card has room and gives major relationships first use of label space. The minimum zoom adapts to the size of the board and viewport. **Find objects** opens full object and relationship details at any zoom.
- Project connectors use rendered card bounds to try clear paths and label positions. Dense lanes can still have crossings or labels that only fit in the outline. The camera leaves the persisted graph and geometry alone.

The build, 84 API checks, 25 frontend checks, 12 stdio and CLI-adapter checks, and the two Project browser regressions passed. The wallet fixture kept all 16 visible title elements at 32% and showed relationship labels at 99%, 55% and 32%. The test measured no overlapping label boxes at those three levels. Chrome zoom runs with 160 cards and 240 connections stayed below 33 ms at the 95th percentile. The before-and-after images are in `work/pre-goal4/`.

The fresh Codex Desktop chat outside the checkout created a tool lending library through MCP. Readback confirmed 11 automatically placed components and 14 connections. Codex queued its Browser tab to open with the chat. A fresh standalone Codex session outside the checkout discovered GRASP and created and read a workshop booking board. The unattended CLI enforced a no-approval policy and blocked the write. The owner can complete that check from interactive Codex by approving the test-board write when prompted.

## Manual acceptance

1. Open [GRASP Projects](http://127.0.0.1:5173/?board=project) in the same browser profile you intend to use. Enter the owner token in GRASP once if prompted. Refresh, reopen the tab, switch boards, and reopen the browser or Codex. Use the same address. Confirm that the session restores each time.
2. On the [desktop test board](http://127.0.0.1:5173/?board=project&projectBoard=f9a3f019-b953-4bc1-8e5a-5a22ecdd5713), use **Fit board**, then zoom out to the minimum and back in. At overview, read the sections and main relationships. Use **Find objects** to inspect a small card and an arrow. At normal zoom, use **Full text** on a long card if offered.
3. Open a fresh Desktop or CLI chat outside the checkout and ask **“Use GRASP to visually design a small application for coordinating volunteer shifts.”** Keep that board open. Select a component and ask **“Explain this on the canvas.”** Check that the new branch is connected, readable and close to its source.
4. Rearrange a component, reroute an arrow, and add a note or an accepted requirement. Ask **“What did I change? Update the proposal.”** Check that the response separates position changes from design decisions, and that the layout and the accepted decision survive the edit. Open a fresh chat and ask it to recover the design from the same board.
5. To check logout in a disposable browser profile, open **Workspace options → Sign out of this browser**. Refresh and verify GRASP prompts for the owner token. **Sign out everywhere** revokes all owner browser sessions. Unlocking again with the owner token restores access.

If the local service has stopped, run `py -3.11 scripts/dev.py` from the GRASP checkout. If Codex still shows the old MCP arguments, use **Settings → MCP servers → Restart** and open a fresh chat.
