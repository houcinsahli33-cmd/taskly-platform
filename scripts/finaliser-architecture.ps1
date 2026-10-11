$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
foreach ($relative in @('client\public\index.html', 'client\private\admin\overview.html', 'server\middleware\publicFiles.js')) {
    if (!(Test-Path -LiteralPath (Join-Path $projectRoot $relative))) {
        throw "Appliquez d'abord les fichiers du correctif dans le projet : $relative manque."
    }
}
$backupRoot = Join-Path $projectRoot ('.taskly-private\architecture-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$oldPublic = Join-Path $projectRoot 'public'
$oldPrivate = Join-Path $projectRoot 'private'
# Une copie ne retire pas les anciens HTML privés restés dans client/public.
foreach ($name in @('client-dashboard.html','artisan-dashboard.html','admin-dashboard.html','admin-login.html')) {
    $legacyPage = Join-Path $projectRoot ('client\public\' + $name)
    if (Test-Path -LiteralPath $legacyPage) {
        $pageBackup = Join-Path $backupRoot 'anciens-html-publics'
        New-Item -ItemType Directory -Path $pageBackup -Force | Out-Null
        Move-Item -LiteralPath $legacyPage -Destination (Join-Path $pageBackup $name)
    }
}
# Préserver les anciennes photos sur disque avant de déplacer les anciens dossiers.
$oldUploads = Join-Path $oldPublic 'uploads'
$newUploads = Join-Path $projectRoot 'client\public\uploads'
if (Test-Path -LiteralPath $oldUploads) {
    foreach ($file in Get-ChildItem -LiteralPath $oldUploads -File -Recurse) {
        $relative = $file.FullName.Substring($oldUploads.Length + 1)
        $target = [IO.Path]::GetFullPath((Join-Path $newUploads $relative))
        if (!$target.StartsWith($newUploads + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Chemin de photo invalide.' }
        if (Test-Path -LiteralPath $target) {
            if ((Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $target).Hash) {
                throw "Photos différentes au même emplacement : $relative. Les originaux sont conservés ; résoudre ce conflit avant de continuer."
            }
        } else {
            New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
            Copy-Item -LiteralPath $file.FullName -Destination $target
        }
    }
}
foreach ($legacy in @($oldPublic, $oldPrivate)) {
    $resolved = [IO.Path]::GetFullPath($legacy)
    if (!(Test-Path -LiteralPath $resolved)) { continue }
    if ($resolved -notin @((Join-Path $projectRoot 'public'), (Join-Path $projectRoot 'private'))) { throw 'Ancien dossier inattendu.' }
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    Move-Item -LiteralPath $resolved -Destination (Join-Path $backupRoot (Split-Path $resolved -Leaf))
}
Write-Host 'Architecture prête : client/public et client/private. Les anciens dossiers éventuels ont été sauvegardés dans .taskly-private.'
Write-Host 'Le fichier server/.env, la base de données et les commits ne sont pas modifiés.'
