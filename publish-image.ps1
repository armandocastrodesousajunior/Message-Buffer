param(
  [switch]$NoPush
)

$IMAGE = "armandocastro/message-buffer"
$ROOT = $PSScriptRoot

$Version = Read-Host "Qual a versão? (ex: v1.0.0)"
if (-not $Version) {
  Write-Host "Versão é obrigatória!" -ForegroundColor Red
  exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Publicando $IMAGE" -ForegroundColor Cyan
Write-Host "  Versão:    $Version" -ForegroundColor Cyan
Write-Host "  Contexto:  $ROOT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Build
Write-Host ">>> docker build -t ${IMAGE}:$Version -t ${IMAGE}:latest ." -ForegroundColor Yellow
docker build -t "${IMAGE}:$Version" -t "${IMAGE}:latest" "$ROOT"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build falhou!" -ForegroundColor Red
  exit 1
}

# Push
if (-not $NoPush) {
  Write-Host ">>> docker push ${IMAGE}:$Version" -ForegroundColor Yellow
  docker push "${IMAGE}:$Version"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Push da versão falhou!" -ForegroundColor Red
    exit 1
  }

  Write-Host ">>> docker push ${IMAGE}:latest" -ForegroundColor Yellow
  docker push "${IMAGE}:latest"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Push do latest falhou!" -ForegroundColor Red
    exit 1
  }
}

Write-Host ""
Write-Host "✅ Publicado com sucesso!" -ForegroundColor Green
Write-Host "   ${IMAGE}:${Version}"
Write-Host "   ${IMAGE}:latest"
