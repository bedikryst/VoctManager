<#
.SYNOPSIS
  Mirrors this repository's git-ignored private working files to the personal OneDrive.

.DESCRIPTION
  The repository is public, so specs, the archive shelf, legal drafts, contracts, the brand lab,
  agent memory and agent instructions exist only on the maintainer's laptop. This script is their
  only off-machine copy.

  Folders are mirrored, not accumulated: a file deleted or overwritten here is deleted or
  overwritten in the copy too, and OneDrive's recycle bin and version history (30 days) are the
  undo. A source folder that is missing or empty is skipped, so an accidental wipe of the working
  tree cannot mirror itself into the backup.

  The target is the personal OneDrive ("OneDrive"), never an organisation's tenant
  ("OneDrive - <organisation>"): the foundation's papers do not belong on an employer's account.

  Runs daily as the Windows scheduled task "VoctManager private backup", which catches up at the
  next start when the laptop was off. By hand, from the repository root:
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\backup-private.ps1
  Each run rewrites _backup.log and, on success, _last-success.txt in the target folder.
#>

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$target = Join-Path $env:USERPROFILE 'OneDrive\Backup\VoctManager-private'
# Robocopy's /UNILOG writes UTF-16, so the script's own log lines use the same encoding.
$log = Join-Path $target '_backup.log'

$folders = @(
    'docs\specs',
    'docs\archive',
    'docs\legal',
    'docs\about',
    'docs\umowy',
    '.agent',
    '.ai',
    '.claude',
    'brand-lab'
)
$rootFiles = @('AGENTS.md', 'AGENTS.override.md', 'CLAUDE.md')

New-Item -ItemType Directory -Force -Path $target | Out-Null
Remove-Item -LiteralPath $log -ErrorAction SilentlyContinue

# Robocopy exit codes 0-7 report what was copied; 8 and above mean something failed.
$failures = @()

foreach ($folder in $folders) {
    $source = Join-Path $repo $folder
    $hasContent = (Test-Path -LiteralPath $source) -and
        (Get-ChildItem -LiteralPath $source -Force -Recurse -File | Select-Object -First 1)
    if (-not $hasContent) {
        Add-Content -LiteralPath $log -Encoding Unicode -Value "SKIPPED (missing or empty): $folder"
        continue
    }
    robocopy $source (Join-Path $target $folder) /MIR /R:1 /W:1 /NP /NDL `
        /XD node_modules __pycache__ .venv /UNILOG+:$log | Out-Null
    if ($LASTEXITCODE -ge 8) { $failures += "$folder (robocopy $LASTEXITCODE)" }
}

robocopy $repo $target $rootFiles /R:1 /W:1 /NP /NDL /UNILOG+:$log | Out-Null
if ($LASTEXITCODE -ge 8) { $failures += "root files (robocopy $LASTEXITCODE)" }

if ($failures.Count -gt 0) {
    Add-Content -LiteralPath $log -Encoding Unicode -Value "FAILED: $($failures -join '; ')"
    exit 1
}

Set-Content -LiteralPath (Join-Path $target '_last-success.txt') -Value (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
exit 0
