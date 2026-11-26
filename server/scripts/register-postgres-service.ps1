<#
    Registers PostgreSQL as a Windows service, so it starts with the computer.

    Right click this file in the file explorer and choose
    "Run with PowerShell" as Administrator, or open PowerShell as
    Administrator and run:

        .\server\scripts\register-postgres-service.ps1
#>

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'Registering PostgreSQL as a Windows service...' -ForegroundColor Cyan

# Find the installation
$base = 'C:\Program Files\PostgreSQL'
if (-not (Test-Path $base)) {
    Write-Host 'No PostgreSQL installation was found in C:\Program Files\PostgreSQL.' -ForegroundColor Red
    exit 1
}

$version = Get-ChildItem $base -Directory |
    Where-Object { $_.Name -match '^\d+$' } |
    Sort-Object { [int]$_.Name } -Descending |
    Select-Object -First 1

$bin = Join-Path $version.FullName 'bin'
$data = Join-Path $version.FullName 'data'
$pgCtl = Join-Path $bin 'pg_ctl.exe'

if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
    Write-Host "The data folder $data is not a PostgreSQL data folder." -ForegroundColor Red
    Write-Host 'Run the installer again to create a fresh database.' -ForegroundColor Yellow
    exit 1
}

# Stop a server that is running by hand, the service needs the port
& $pgCtl -D $data stop 2>$null | Out-Null

$serviceName = 'postgresql-x64-17'

# Remove an old registration
if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
    & $pgCtl unregister -N $serviceName 2>$null | Out-Null
}

& $pgCtl register -N $serviceName -D $data -U 'NT AUTHORITY\NetworkService' -S auto

if ($LASTEXITCODE -ne 0) {
    Write-Host 'The service could not be registered.' -ForegroundColor Red
    exit 1
}

Start-Service $serviceName
Start-Sleep -Seconds 3

$service = Get-Service -Name $serviceName
Write-Host ''
Write-Host "Service '$serviceName' is now $($service.Status) and starts with Windows." -ForegroundColor Green
Write-Host ''
Write-Host 'Next: create the tables with' -ForegroundColor Cyan
Write-Host '    npm run db:setup --workspace server' -ForegroundColor White
Write-Host ''
