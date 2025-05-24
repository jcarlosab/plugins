# Crear directorio de distribución si no existe
if (-not (Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist"
}

# Comprimir los archivos de la extensión
Compress-Archive -Path "src\*" -DestinationPath "dist\youtube-shorts-blocker.zip" -Force

Write-Host 'Extension comprimida exitosamente en dist\youtube-shorts-blocker.zip!'
Write-Host 'Para instalar la extension:'
Write-Host '1. Abre Chrome y ve a chrome://extensions/'
Write-Host '2. Activa el "Modo desarrollador"'
Write-Host '3. Arrastra y suelta el archivo zip en la pagina de extensiones'