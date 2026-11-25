# Working with GRASP from Codex or Claude Code

Install the existing GRASP MCP adapter and start the workspace. From the GRASP checkout, install the user-level skill for each client you use. Open a fresh local conversation after installation.

```powershell
.\scripts\install-grasp-skill.ps1 -Agent Codex
.\scripts\install-grasp-skill.ps1 -Agent ClaudeCode
```

Codex sees `grasp-canvas` from any project directory. Use the skill explicitly as `$grasp-canvas` in Codex or `/grasp-canvas` in Claude Code, or ask the agent to work on a GRASP board. The installer leaves a different existing skill file in place unless you pass `-Force`. [Codex MCP setup](phase-3.md#register-once-for-codex-desktop-and-cli) · [Skill source](../../skills/grasp-canvas/SKILL.md)

In Claude Code, register the same adapter once at user scope. The configuration stores the path to the ignored `.env`.

```powershell
$graspPython = (Resolve-Path -LiteralPath '.venv-mcp/Scripts/python.exe').Path
$graspSettings = (Resolve-Path -LiteralPath '.env').Path
claude mcp add --scope user --transport stdio --env "GRASP_ENV_FILE=$graspSettings" grasp -- $graspPython -m grasp_agent mcp serve
```

## Try a collaboration

If GRASP was running before this update, stop the old development server with Ctrl+C. Run `py -3.11 scripts/dev.py` from the checkout and open a fresh local Codex conversation.

1. Ask the agent to create a GRASP board for an AI video editor with a **Video rendering** card and a path to **Publishing**. Open that board in Projects, or use `grasp open BOARD_ID`.
2. Select **Video rendering** and ask “Explain the selected component.” The agent should identify the card from its latest board read.
3. Add an **Approval before publishing** note. Move **Publishing** and connect the note to it. Ask “Review my latest board changes.” Check that the agent identifies the note, arrow and move with user attribution.
4. Ask for a human approval gate. Keep the board open while the agent makes the edit. Verify the same board updates and your note, arrow and placement remain. Select the new gate and ask a follow-up about it.
5. Open another Project board in a separate tab. The agent should keep working on the first board in the existing conversation. A fresh conversation asking for “the current board” should ask you to choose if both tabs are sharing context.

Presence expires after 25 seconds without a heartbeat. Keep the GRASP tab visible while you work, or focus it and select again if the agent reports a stale or unavailable selection. The saved board and revision history are still available by name or ID after the tab closes.

## Context and writes

`get_board_context` resolves a single active board with no arguments. It reports no active board or named candidates when it cannot resolve one. Pass `board_id` for a known board and `since_revision` for a previous read of that board. The result includes the saved objects and connections, selection status, annotation and requirement IDs, agent proposal IDs, and a page of revision changes with commit attribution. If it returns `changes.nextSinceRevision`, use that value to continue the history read for the same board. The board snapshot always shows the current saved head.

The existing MCP tools still expose board reads, search and exact source quotes, and revision-checked writes. Ask the agent to review intervening changes if a write conflicts. Owner-authored annotation text, requirement decisions and question answers are protected by the board service. Use approval for consequential edits, and explicitly authorize code implementation when the design is ready. [Canvas operation contract](phase-2.md#http-contract-for-phase-3)
