# PowerShell script для Windows
Write-Host "📥 Скачивание моделей для распознавания лиц..." -ForegroundColor Cyan
Write-Host ""

$modelsPath = Join-Path $PSScriptRoot "..\public\models"
Set-Location $modelsPath

$models = @(
    "https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-weights_manifest.json",
    "https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-shard1",
    "https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-weights_manifest.json",
    "https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-shard1"
)

foreach ($url in $models) {
    $filename = Split-Path $url -Leaf
    Write-Host "⬇️  Скачивание $filename..." -ForegroundColor Yellow
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $filename -UseBasicParsing
        Write-Host "✅ $filename скачан" -ForegroundColor Green
    } catch {
        Write-Host "❌ Ошибка при скачивании $filename" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "🎉 Все модели успешно скачаны!" -ForegroundColor Green
Write-Host "📊 Размер файлов:" -ForegroundColor Cyan
Get-ChildItem | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $size = if ($_.Length -gt 1MB) {
        "{0:N2} MB" -f ($_.Length / 1MB)
    } elseif ($_.Length -gt 1KB) {
        "{0:N2} KB" -f ($_.Length / 1KB)
    } else {
        "{0} B" -f $_.Length
    }
    Write-Host "    $($_.Name) - $size"
}
Write-Host ""
Write-Host "✨ Теперь редактор фотоальбома сможет распознавать лица!" -ForegroundColor Green
