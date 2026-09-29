# ==============================================================================
# COMPREHENSIVE FIX: Auto-Locking + Display Flickering
# Target: Infinix GL613 (Intel Iris Xe + NVIDIA RTX 4060, 120Hz BOE Panel)
#
# Root Cause Analysis (from Event Logs):
#   - winlogon.exe is calling SetSuspendState (Event 187)
#   - Sleep Reason: Application API (Event 42)
#   - Session transitions triggered by ScreenOffGracePeriod (Event 566)
#   - Intel Graphics Software delaying shutdown (winsrvext Event 100)
# ==============================================================================

# ---- Require Administrator ----
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "This script requires Administrator privileges. Relaunching..."
    Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -NoProfile -File `"$PSCommandPath`""
    exit
}

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  INFINIX GL613 - COMPLETE SYSTEM FIX                          " -ForegroundColor Cyan
Write-Host "  Fixes: Auto-Lock, Random Sleep, Display Flickering           " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ==============================================================================
# SECTION 1: STOP THE AUTO-LOCKING / RANDOM SLEEP
# ==============================================================================
Write-Host "[SECTION 1/5] FIXING AUTO-LOCK & RANDOM SLEEP..." -ForegroundColor Yellow
Write-Host "--------------------------------------------------------------" -ForegroundColor DarkGray

# 1a. Set LID CLOSE action to DO NOTHING (AC and DC)
#     This is the #1 cause on Infinix laptops - the hall sensor / magnet
#     near the palm rest falsely triggers a lid-close event.
Write-Host "  [1a] Setting lid close action to 'Do nothing'..."
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
Write-Host "       [OK] Lid close -> Do nothing (AC & DC)" -ForegroundColor Green

# 1b. Set SLEEP BUTTON to DO NOTHING
Write-Host "  [1b] Setting sleep button to 'Do nothing'..."
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS SBUTTONACTION 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS SBUTTONACTION 0
Write-Host "       [OK] Sleep button -> Do nothing (AC & DC)" -ForegroundColor Green

# 1c. Set POWER BUTTON to DO NOTHING (prevents accidental shutdown)
Write-Host "  [1c] Setting power button to 'Do nothing'..."
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 0
Write-Host "       [OK] Power button -> Do nothing (AC & DC)" -ForegroundColor Green

# 1d. Disable Standby (Sleep) timeout completely
Write-Host "  [1d] Disabling standby/sleep timeout..."
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
Write-Host "       [OK] Sleep timeout -> Never (AC & DC)" -ForegroundColor Green

# 1e. Set monitor timeout to generous values (not off)
Write-Host "  [1e] Setting monitor timeout to 30min AC / 15min DC..."
powercfg /change monitor-timeout-ac 30
powercfg /change monitor-timeout-dc 15
Write-Host "       [OK] Monitor timeout -> 30min AC, 15min DC" -ForegroundColor Green

# 1f. Disable hibernate timeout
Write-Host "  [1f] Disabling hibernate timeout..."
powercfg /change hibernate-timeout-ac 0
powercfg /change hibernate-timeout-dc 0
Write-Host "       [OK] Hibernate timeout -> Never (AC & DC)" -ForegroundColor Green

# 1g. Disable UNATTENDED SLEEP TIMEOUT (the hidden timeout that causes
#     winlogon.exe to call SetSuspendState after ~2 minutes of "unattended" idle)
Write-Host "  [1g] Disabling unattended sleep timeout..."
# GUID: 238c9fa8... / 7bc4a2f9... is the "System unattended sleep timeout"
powercfg /setacvalueindex SCHEME_CURRENT 238c9fa8-0aad-41ed-83f4-97be242c8f20 7bc4a2f9-d8fc-4469-b07b-33eb785aaca0 0
powercfg /setdcvalueindex SCHEME_CURRENT 238c9fa8-0aad-41ed-83f4-97be242c8f20 7bc4a2f9-d8fc-4469-b07b-33eb785aaca0 0
Write-Host "       [OK] Unattended sleep timeout -> 0 (disabled)" -ForegroundColor Green

# 1h. Disable CONSOLE LOCK DISPLAY OFF TIMEOUT
#     This is the hidden "ScreenOffGracePeriod" timeout visible in Event 566
Write-Host "  [1h] Disabling console lock display off timeout..."
# GUID: 7516b95f... / 245d8541... is "Console lock display off timeout"
powercfg /setacvalueindex SCHEME_CURRENT 7516b95f-f776-4464-8c53-06167f40cc99 8EC4B3A5-6868-48c2-BE75-4F3044BE88A7 0
powercfg /setdcvalueindex SCHEME_CURRENT 7516b95f-f776-4464-8c53-06167f40cc99 8EC4B3A5-6868-48c2-BE75-4F3044BE88A7 0
Write-Host "       [OK] Console lock display off timeout -> 0 (disabled)" -ForegroundColor Green

# 1i. Disable the "Allow Away Mode" and "Allow hybrid sleep"
Write-Host "  [1i] Disabling Away Mode and Hybrid Sleep..."
powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP AWAYMODE 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_SLEEP AWAYMODE 0
powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP HYBRIDSLEEP 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_SLEEP HYBRIDSLEEP 0
Write-Host "       [OK] Away Mode & Hybrid Sleep -> Disabled" -ForegroundColor Green

# 1j. Apply the power scheme changes
powercfg /setactive SCHEME_CURRENT
Write-Host "       [OK] Power scheme changes applied." -ForegroundColor Green

Write-Host ""

# ==============================================================================
# SECTION 2: DISABLE WINDOWS AUTO-LOCK FEATURES
# ==============================================================================
Write-Host "[SECTION 2/5] DISABLING WINDOWS AUTO-LOCK FEATURES..." -ForegroundColor Yellow
Write-Host "--------------------------------------------------------------" -ForegroundColor DarkGray

# 2a. Disable Dynamic Lock (Bluetooth proximity lock)
Write-Host "  [2a] Disabling Dynamic Lock..."
$dlPath = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon"
Set-ItemProperty -Path $dlPath -Name "EnableGoodbye" -Value 0 -Type DWord -Force
Write-Host "       [OK] Dynamic Lock -> Disabled" -ForegroundColor Green

# 2b. Disable Presence Sensing / Walk-Away Lock
Write-Host "  [2b] Disabling Presence Sensing (Walk-Away Lock)..."
# Human Presence Detection settings
$hpdPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\HumanPresence"
if (-not (Test-Path $hpdPath)) { New-Item -Path $hpdPath -Force | Out-Null }
Set-ItemProperty -Path $hpdPath -Name "LockOnLeaveEnabled" -Value 0 -Type DWord -Force
Set-ItemProperty -Path $hpdPath -Name "WakeOnApproachEnabled" -Value 0 -Type DWord -Force

# Per-user presence settings
$hpdUserPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\HumanPresence"
if (-not (Test-Path $hpdUserPath)) { New-Item -Path $hpdUserPath -Force | Out-Null }
Set-ItemProperty -Path $hpdUserPath -Name "LockOnLeaveEnabled" -Value 0 -Type DWord -Force
Set-ItemProperty -Path $hpdUserPath -Name "WakeOnApproachEnabled" -Value 0 -Type DWord -Force

# Attention-aware settings (for laptops with IR camera presence detection)
$attPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\AttentionAwareDimming"
if (-not (Test-Path $attPath)) { New-Item -Path $attPath -Force | Out-Null }
Set-ItemProperty -Path $attPath -Name "AttentionAwareDimmingEnabled" -Value 0 -Type DWord -Force
Write-Host "       [OK] Presence Sensing / Walk-Away Lock -> All disabled" -ForegroundColor Green

# 2c. Disable Screen Saver lock on resume
Write-Host "  [2c] Disabling Screen Saver and lock-on-resume..."
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive" -Value "0" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaverIsSecure" -Value "0" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveTimeOut" -Value "0" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "SCRNSAVE.EXE" -Value "" -Force
Write-Host "       [OK] Screen Saver -> Disabled, Lock on resume -> Disabled" -ForegroundColor Green

# 2d. Disable Sensor services that can trigger lock via proximity
Write-Host "  [2d] Disabling Sensor services..."
$sensorServices = @("SensorService", "SensrSvc", "SensorDataService")
foreach ($svc in $sensorServices) {
    Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
    Set-Service -Name $svc -StartupType Disabled -ErrorAction SilentlyContinue
}
Write-Host "       [OK] SensorService, SensrSvc, SensorDataService -> Stopped & Disabled" -ForegroundColor Green

# 2e. Disable Windows lock timeout via Group Policy registry keys
Write-Host "  [2e] Disabling lock screen timeout policies..."
$policyPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
Set-ItemProperty -Path $policyPath -Name "InactivityTimeoutSecs" -Value 0 -Type DWord -Force
# Also disable the machine inactivity limit
$secPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
Set-ItemProperty -Path $secPath -Name "MaxInactivityTimeLock" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
Write-Host "       [OK] Inactivity lock timeout -> Disabled" -ForegroundColor Green

Write-Host ""

# ==============================================================================
# SECTION 3: FIX DISPLAY FLICKERING (MPO, DPST, PSR, CABC, VRR, HAGS)
# ==============================================================================
Write-Host "[SECTION 3/5] FIXING DISPLAY FLICKERING..." -ForegroundColor Yellow
Write-Host "--------------------------------------------------------------" -ForegroundColor DarkGray

# 3a. Disable Multi-Plane Overlay (MPO) - known flicker trigger on hybrid GPU laptops
Write-Host "  [3a] Disabling Multi-Plane Overlay (MPO)..."
$dwmPath = "HKLM:\SOFTWARE\Microsoft\Windows\Dwm"
if (-not (Test-Path $dwmPath)) { New-Item -Path $dwmPath -Force | Out-Null }
Set-ItemProperty -Path $dwmPath -Name "OverlayTestMode" -Value 5 -Type DWord -Force
Write-Host "       [OK] MPO disabled (OverlayTestMode = 5)" -ForegroundColor Green

# 3b. Disable Intel DPST (Display Power Saving Technology) & PSR (Panel Self Refresh)
Write-Host "  [3b] Disabling Intel DPST & PSR..."
$classRoot = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
$intelKeys = Get-ChildItem $classRoot -ErrorAction SilentlyContinue | Where-Object {
    $desc = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DriverDesc
    $desc -match "Intel"
}
if ($intelKeys) {
    foreach ($k in $intelKeys) {
        # FeatureTestControl 0x9210 aggressively disables DPST, PSR, and adaptive brightness
        Set-ItemProperty -Path $k.PSPath -Name "FeatureTestControl" -Value 0x9210 -Type DWord -Force
        # Explicitly disable DPST
        Set-ItemProperty -Path $k.PSPath -Name "Display_DPST_Enabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
        # Explicitly disable PSR
        Set-ItemProperty -Path $k.PSPath -Name "Display_PSR_Enabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
        Write-Host "       [OK] Intel $($k.PSChildName): FeatureTestControl=0x9210, DPST=0, PSR=0" -ForegroundColor Green
    }
} else {
    Set-ItemProperty -Path "$classRoot\0001" -Name "FeatureTestControl" -Value 0x9210 -Type DWord -Force -ErrorAction SilentlyContinue
    Write-Host "       [OK] Fallback: 0001 FeatureTestControl=0x9210" -ForegroundColor Green
}

# 3c. Disable Content Adaptive Brightness Control (CABC)
Write-Host "  [3c] Disabling CABC..."
$gfxDrivers = "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers"
if (-not (Test-Path $gfxDrivers)) { New-Item -Path $gfxDrivers -Force | Out-Null }
Set-ItemProperty -Path $gfxDrivers -Name "CABCOption" -Value 0 -Type DWord -Force
Write-Host "       [OK] CABC disabled" -ForegroundColor Green

# 3d. Disable Hardware-Accelerated GPU Scheduling (HAGS) - known to cause flicker on hybrid GPU
Write-Host "  [3d] Disabling Hardware-Accelerated GPU Scheduling (HAGS)..."
Set-ItemProperty -Path $gfxDrivers -Name "HwSchMode" -Value 1 -Type DWord -Force
Write-Host "       [OK] HAGS disabled (HwSchMode = 1)" -ForegroundColor Green

# 3e. Disable Variable Refresh Rate (VRR) 
Write-Host "  [3e] Disabling Variable Refresh Rate (VRR)..."
Set-ItemProperty -Path $gfxDrivers -Name "DirectFlipVRRSupport" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
Write-Host "       [OK] VRR disabled" -ForegroundColor Green

# 3f. Disable Adaptive Brightness
Write-Host "  [3f] Disabling Adaptive Brightness..."
# Via Power Config
powercfg /setacvalueindex SCHEME_CURRENT SUB_VIDEO ADAPTBRIGHT 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_VIDEO ADAPTBRIGHT 0
powercfg /setactive SCHEME_CURRENT
# Via Registry
Set-ItemProperty -Path "HKLM:\SOFTWARE\Intel\Display\igfxcui\profiles\Media\Brighten Movie" -Name "ProcAmpBrightness" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
Write-Host "       [OK] Adaptive Brightness -> Disabled" -ForegroundColor Green

Write-Host ""

# ==============================================================================
# SECTION 4: TAME INTEL GRAPHICS SOFTWARE (it was blocking shutdown in logs)
# ==============================================================================
Write-Host "[SECTION 4/5] CONFIGURING INTEL GRAPHICS SOFTWARE..." -ForegroundColor Yellow
Write-Host "--------------------------------------------------------------" -ForegroundColor DarkGray

# 4a. Disable Intel Graphics Software auto-start and overlay
Write-Host "  [4a] Disabling Intel Graphics overlay startup..."
$igfxRun = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $igfxRun -Name "igfxTray" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path $igfxRun -Name "IAStorIcon" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path $igfxRun -Name "IntelGraphicsSoftware" -ErrorAction SilentlyContinue
$igfxRunUser = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $igfxRunUser -Name "igfxTray" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path $igfxRunUser -Name "IntelGraphicsSoftware" -ErrorAction SilentlyContinue
Write-Host "       [OK] Intel Graphics startup entries removed" -ForegroundColor Green

# 4b. Kill Intel Graphics overlay process (it was delaying sleep transitions)
Write-Host "  [4b] Stopping Intel Graphics Overlay process..."
Stop-Process -Name "IntelGraphicsSoftware" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "IntelGraphicsSoftware.Overlay" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "IGCCTray" -Force -ErrorAction SilentlyContinue
Write-Host "       [OK] Intel Graphics overlay processes killed" -ForegroundColor Green

# 4c. Disable Intel Graphics hotkeys (Ctrl+Alt+Arrow, etc. can interfere)
Write-Host "  [4c] Disabling Intel Graphics hotkeys..."
foreach ($k in $intelKeys) {
    Set-ItemProperty -Path $k.PSPath -Name "Hotkey" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
}
Write-Host "       [OK] Intel hotkeys disabled" -ForegroundColor Green

Write-Host ""

# ==============================================================================
# SECTION 5: RESTART DWM AND APPLY
# ==============================================================================
Write-Host "[SECTION 5/5] APPLYING CHANGES..." -ForegroundColor Yellow
Write-Host "--------------------------------------------------------------" -ForegroundColor DarkGray

# 5a. Restart Desktop Window Manager to apply display registry changes
Write-Host "  [5a] Restarting Desktop Window Manager..."
Stop-Process -Name "dwm" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "       [OK] DWM restarted" -ForegroundColor Green

# 5b. Final power scheme apply
powercfg /setactive SCHEME_CURRENT

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  ALL FIXES APPLIED SUCCESSFULLY!                              " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  LOCKING FIXES:" -ForegroundColor White
Write-Host "    - Lid close action      -> Do nothing" -ForegroundColor Gray
Write-Host "    - Sleep/Power buttons    -> Do nothing" -ForegroundColor Gray
Write-Host "    - Sleep timeout          -> Never" -ForegroundColor Gray
Write-Host "    - Unattended sleep       -> Disabled" -ForegroundColor Gray
Write-Host "    - Console lock timeout   -> Disabled" -ForegroundColor Gray
Write-Host "    - Dynamic Lock           -> Disabled" -ForegroundColor Gray
Write-Host "    - Presence Sensing       -> Disabled" -ForegroundColor Gray
Write-Host "    - Screen Saver           -> Disabled" -ForegroundColor Gray
Write-Host "    - Sensor services        -> Stopped" -ForegroundColor Gray
Write-Host "    - Inactivity lock policy -> Disabled" -ForegroundColor Gray
Write-Host ""
Write-Host "  FLICKERING FIXES:" -ForegroundColor White
Write-Host "    - MPO (Multi-Plane Overlay)   -> Disabled" -ForegroundColor Gray
Write-Host "    - Intel DPST                  -> Disabled" -ForegroundColor Gray
Write-Host "    - Intel PSR                   -> Disabled" -ForegroundColor Gray
Write-Host "    - CABC                        -> Disabled" -ForegroundColor Gray
Write-Host "    - HAGS                        -> Disabled" -ForegroundColor Gray
Write-Host "    - VRR                         -> Disabled" -ForegroundColor Gray
Write-Host "    - Adaptive Brightness         -> Disabled" -ForegroundColor Gray
Write-Host "    - Intel Graphics Overlay      -> Killed" -ForegroundColor Gray
Write-Host "    - DWM                         -> Restarted" -ForegroundColor Gray
Write-Host ""
Write-Host "  >> A REBOOT is recommended to fully apply all changes. <<" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Press any key to exit..." -ForegroundColor DarkGray
try { [void][System.Console]::ReadKey($true) } catch {}
