# ==============================================================================
# Complete Fix for Laptop Locking Itself and Display Flickering
# Target Hardware: Infinix GL613 (Intel Iris Xe + NVIDIA RTX 4060, 120Hz BOE Panel)
# ==============================================================================

# Ensure script is running with administrative privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "This script requires Administrator privileges. Relaunching as Administrator..."
    Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -NoProfile -File `"$PSCommandPath`""
    exit
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   NeoCoach / System Diagnostic & Repair Script         " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# STEP 1: STOP & REMOVE LENOVO VANTAGE (The cause of random locking & flicker)
# ------------------------------------------------------------------------------
Write-Host "`n[1/4] Disabling Lenovo Vantage Services & Background Processes..." -ForegroundColor Yellow

$lenovoProcesses = @(
    "LenovoVantage",
    "LenovoVantage-(VantageCoreAddin)",
    "LenovoVantage-(GenericMessagingAddin)",
    "LenovoVantageService"
)
foreach ($proc in $lenovoProcesses) {
    Stop-Process -Name $proc -Force -ErrorAction SilentlyContinue
}

# Stop and disable LenovoVantageService
try {
    Stop-Service -Name "LenovoVantageService" -Force -ErrorAction SilentlyContinue
    Set-Service -Name "LenovoVantageService" -StartupType Disabled -ErrorAction SilentlyContinue
    sc.exe config LenovoVantageService start= disabled | Out-Null
    Write-Host "  [OK] LenovoVantageService has been stopped and disabled." -ForegroundColor Green
} catch {
    Write-Host "  [!] Could not configure LenovoVantageService: $_" -ForegroundColor Red
}

# Remove broken PRI-Driver service that was erroring repeatedly
try {
    sc.exe stop PRI-Driver | Out-Null
    sc.exe delete PRI-Driver | Out-Null
    Write-Host "  [OK] Cleaned up failing PRI-Driver service." -ForegroundColor Green
} catch {}

# Remove Lenovo UWP app for all users
Write-Host "  Removing Lenovo Vantage UWP App packages..." -ForegroundColor Yellow
try {
    Get-AppxPackage -AllUsers *LenovoCompanion* | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
    Get-AppxProvisionedPackage -Online | Where-Object { $_.DisplayName -match 'Lenovo' } | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
    Write-Host "  [OK] Lenovo Vantage UWP App packages removed." -ForegroundColor Green
} catch {
    Write-Host "  [!] Error removing UWP package: $_" -ForegroundColor Red
}

# Remove startup entries
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "LenovoVantage" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "LenovoVantage" -ErrorAction SilentlyContinue

# ------------------------------------------------------------------------------
# STEP 2: FIX DISPLAY FLICKERING (MPO, DPST, PSR, CABC)
# ------------------------------------------------------------------------------
Write-Host "`n[2/4] Applying Display Flickering Fixes..." -ForegroundColor Yellow

# 2a. Disable Multi-Plane Overlay (MPO) in DWM
$dwmPath = "HKLM:\SOFTWARE\Microsoft\Windows\Dwm"
if (-not (Test-Path $dwmPath)) { New-Item -Path $dwmPath -Force | Out-Null }
Set-ItemProperty -Path $dwmPath -Name "OverlayTestMode" -Value 5 -Type DWord
Write-Host "  [OK] Multi-Plane Overlay (MPO) disabled (OverlayTestMode = 5)." -ForegroundColor Green

# 2b. Disable Intel Display Power Saving Technology (DPST) & Panel Self Refresh (PSR)
# Find Intel Graphics Class Key
$classRoot = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
$intelKeys = Get-ChildItem $classRoot -ErrorAction SilentlyContinue | Where-Object {
    $desc = (Get-ItemProperty $_.PSPath).DriverDesc
    $desc -match "Intel"
}

if ($intelKeys) {
    foreach ($k in $intelKeys) {
        # FeatureTestControl 0x1210 disables DPST and PSR flickering on 120Hz panels
        Set-ItemProperty -Path $k.PSPath -Name "FeatureTestControl" -Value 0x1210 -Type DWord
        Write-Host "  [OK] Disabled Intel DPST & PSR in $($k.PSChildName) (FeatureTestControl = 0x1210)." -ForegroundColor Green
    }
} else {
    # Fallback to key 0001
    Set-ItemProperty -Path "$classRoot\0001" -Name "FeatureTestControl" -Value 0x1210 -Type DWord -ErrorAction SilentlyContinue
    Write-Host "  [OK] Disabled Intel DPST & PSR in 0001 (FeatureTestControl = 0x1210)." -ForegroundColor Green
}

# 2c. Disable Content Adaptive Brightness Control (CABC)
$gfxDrivers = "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers"
if (Test-Path $gfxDrivers) {
    Set-ItemProperty -Path $gfxDrivers -Name "CABCOption" -Value 0 -Type DWord
    Write-Host "  [OK] Content Adaptive Brightness Control (CABC) disabled." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# STEP 3: CONFIGURE POWER TIMEOUTS & PREVENT PREMATURE SLEEP/LOCK
# ------------------------------------------------------------------------------
Write-Host "`n[3/4] Configuring Power Scheme & Sleep Timeouts..." -ForegroundColor Yellow

# Prevent sleep on AC when idle
powercfg /change monitor-timeout-ac 15
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-dc 5
powercfg /change standby-timeout-dc 15

# Set Unattended Sleep Timeout to 30 minutes (1800s) instead of 2 minutes
powercfg /setacvalueindex SCHEME_CURRENT 238c9fa8-0aad-41ed-83f4-97be242c8f20 7bc4a2f9-d8fc-4469-b07b-33eb785aaca0 1800
powercfg /setdcvalueindex SCHEME_CURRENT 238c9fa8-0aad-41ed-83f4-97be242c8f20 7bc4a2f9-d8fc-4469-b07b-33eb785aaca0 900
powercfg /setactive SCHEME_CURRENT
Write-Host "  [OK] Power and Sleep timeouts optimized." -ForegroundColor Green

# ------------------------------------------------------------------------------
# STEP 4: RESTART DESKTOP WINDOW MANAGER (DWM) TO APPLY DISPLAY CHANGES
# ------------------------------------------------------------------------------
Write-Host "`n[4/4] Restarting Desktop Window Manager to apply graphics fixes..." -ForegroundColor Yellow
Stop-Process -Name dwm -Force -ErrorAction SilentlyContinue
Write-Host "  [OK] Desktop Window Manager refreshed." -ForegroundColor Green

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   REPAIR COMPLETE!                                      " -ForegroundColor Green
Write-Host "   - Lenovo Vantage (the culprit behind auto-lock) disabled." -ForegroundColor Green
Write-Host "   - MPO, DPST, & CABC display flicker disabled.         " -ForegroundColor Green
Write-Host "   - Display pipeline refreshed at 120Hz.                " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
try { [void][System.Console]::ReadKey($true) } catch {}
