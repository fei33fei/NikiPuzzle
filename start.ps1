$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { Write-Host 'NikiPuzzle needs Node.js 18 or newer. Please install Node.js, then run start.cmd again.'; exit 1 }
$port = 4173
$url = "http://127.0.0.1:$port"
try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; $running = $response.Content -match '<title>NikiPuzzle' } catch { $running = $false }
if (-not $running) {
  $serverPath = Join-Path $projectDir 'server.mjs'
  Start-Process -FilePath $nodeCommand.Source -ArgumentList @('"' + $serverPath + '"') -WorkingDirectory $projectDir -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 300
    try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1; if ($response.Content -match '<title>NikiPuzzle') { $running = $true; break } } catch { }
  }
}
if (-not $running) { Write-Host 'Could not start NikiPuzzle. Port 4173 may be in use. Run npm start to inspect the error.'; exit 1 }
$edgePath = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
$chromePath = Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'
if (Test-Path -LiteralPath $edgePath) { Start-Process -FilePath $edgePath -ArgumentList "--app=$url" }
elseif (Test-Path -LiteralPath $chromePath) { Start-Process -FilePath $chromePath -ArgumentList "--app=$url" }
else { Start-Process $url }
