# Checks that a Windows pointo.exe carries its compiled DirectX shaders instead of reading the
# .hlsl sources at run time. gpui 0.2.2 debug builds compiled them from CARGO_MANIFEST_DIR, a path
# that only exists on the build machine, so the CI artifact died on start with
# "Error creating DirectWriteTextSystem".
#
#   pwsh scripts/check-windows-shaders-embedded.ps1 target\debug\pointo.exe

param([Parameter(Mandatory = $true)][string]$Exe)
$ErrorActionPreference = "Stop"

$text = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($Exe))
$hits = @([regex]::Matches($text, '[\w.:/\\-]{0,120}(shaders|color_text_raster)\.hlsl') | ForEach-Object { $_.Value })
if ($hits.Count -gt 0) {
  Write-Host "$Exe reads HLSL sources at run time:"
  $hits | Select-Object -Unique | ForEach-Object { Write-Host "  $_" }
  exit 1
}
Write-Host "${Exe}: shaders embedded"
