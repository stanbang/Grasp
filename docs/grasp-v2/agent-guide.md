# Working with GRASP from Codex or Claude Code

Install the GRASP adapter in its Python environment once. Then run `grasp setup` to configure the local workspace and install the MCP server and skill for the agents it detects.

```powershell
py -3.11 -m venv .venv-mcp
.\.venv-mcp\Scripts\python.exe -m pip install -e .\apps\agent
.\.venv-mcp\Scripts\grasp.exe setup
```

Setup keeps existing credentials in the ignored GRASP `.env` and creates distinct ones when missing. It uses the client's user-level MCP registry and keeps a different GRASP registration intact. It updates a previously installed GRASP skill. To replace a customized copy, explicitly add `--replace-skill`. Use `--agent codex` or `--agent claude-code` to select a client.

Start the workspace from the checkout with `py -3.11 scripts/dev.py`. Add `--setup` on the first checkout to install the app dependencies. In another terminal, run `grasp doctor` to check the API, browser endpoint, MCP registration and installed skill. Run `grasp open` to open Projects in your normal browser. When the venv is active, use `grasp` directly. Otherwise use `.\.venv-mcp\Scripts\grasp.exe` from the checkout.

Open a fresh local agent conversation after setup. If Codex has cached an earlier tool list, use **Settings → MCP servers → Restart**, then open the fresh chat. Use `$grasp-canvas` in Codex or `/grasp-canvas` in Claude Code if you want to select the skill explicitly. [Skill source](../../apps/agent/src/grasp_agent/skills/grasp-canvas/SKILL.md) · [Codex MCP setup](https://learn.chatgpt.com/docs/extend/mcp#configure-in-the-chatgpt-desktop-app)

## Try a collaboration

Start in a fresh local Codex Desktop chat outside the GRASP checkout. Ask “Help me design an AI video editor that automatically creates cuts, generates captions and publishes videos to Instagram. Let’s work through it visually before building.”

1. Keep the GRASP tab open alongside the chat. If needed, use **Enter split view** or cycle layouts with **Ctrl+Shift+B** on Windows. Enter the workspace owner token directly in GRASP when the page asks you to unlock it.
2. Select a component and ask “Explain this.”
3. Add an approval note, move a publishing component and connect the note to it. Ask “What do you think of my changes?”
4. Ask “Update the design based on my feedback.” Watch the same board update and check that your note, arrow and placement remain.
5. Select another component and ask a follow-up. A fresh chat should ask which board you mean if several are actively shared.

The canvas uses Codex’s built-in browser. Codex CLI and other clients without that browser can use the same live board in an external browser. The app keeps its owner unlock for the life of the loaded page. Browser presence expires after 25 seconds without a heartbeat. If the selection isn’t available, focus the board and select the object again. [Browser and split view](https://learn.chatgpt.com/docs/browser#arrange-tabs-and-chat)

## Context and writes

`get_board_context` resolves a single active board with no arguments. It reports no active board or named candidates when it cannot resolve one. The MCP response includes `workspaceUrl` and, for a resolved board, `boardUrl`. Pass `board_id` for a known board and `since_revision` for a previous read of that board. The result includes the saved objects and connections, selection status, annotation and requirement IDs, agent proposal IDs, and a page of revision changes with commit attribution. If it returns `changes.nextSinceRevision`, use that value to continue the history read for the same board. The board snapshot always shows the current saved head.

The existing MCP tools still expose board reads, search and exact source quotes, and revision-checked writes. Ask the agent to review intervening changes if a write conflicts. Owner-authored annotation text, requirement decisions and question answers are protected by the board service. Use approval for consequential edits, and explicitly authorize code implementation when the design is ready. [Canvas operation contract](phase-2.md#http-contract-for-phase-3)
