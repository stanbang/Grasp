param(
    [ValidateSet('Codex', 'ClaudeCode')]
    [string]$Agent = 'Codex',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '../apps/agent/src/grasp_agent/skills/grasp-canvas/SKILL.md'
$userDirectory = [Environment]::GetFolderPath('UserProfile')
$skillsDirectory = if ($Agent -eq 'Codex') {
    Join-Path $userDirectory '.agents/skills'
} elseif ($env:CLAUDE_CONFIG_DIR) {
    Join-Path $env:CLAUDE_CONFIG_DIR 'skills'
} else {
    Join-Path $userDirectory '.claude/skills'
}
$skillDirectory = Join-Path $skillsDirectory 'grasp-canvas'
$destination = Join-Path $skillDirectory 'SKILL.md'

if (Test-Path -LiteralPath $destination) {
    if ((Get-FileHash -LiteralPath $source).Hash -eq (Get-FileHash -LiteralPath $destination).Hash) {
        Write-Output "GRASP skill already installed for ${Agent} at $destination"
        return
    }
    if (-not $Force) {
        throw "A different GRASP skill already exists at $destination. Use -Force to replace it."
    }
}
New-Item -ItemType Directory -Path $skillDirectory -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $destination -Force
Write-Output "Installed the GRASP skill for ${Agent} at $destination"
