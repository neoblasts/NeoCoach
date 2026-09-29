# Non-interactive version: Apply all fixes that DON'T need admin first
$ErrorActionPreference = "SilentlyContinue"

Write-Host "Applying user-level fixes (no admin needed)..." -ForegroundColor Cyan

# Dynamic Lock
$dlPath = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon"
Set-ItemProperty -Path $dlPath -Name "EnableGoodbye" -Value 0 -Type DWord -Force
Write-Host "[OK] Dynamic Lock disabled" -ForegroundColor Green

# Presence Sensing (user hive)
$hpdUserPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\HumanPresence"
if (-not (Test-Path $hpdUserPath)) { New-Item -Path $hpdUserPath -Force | Out-Null }
Set-ItemProperty -Path $hpdUserPath -Name "LockOnLeaveEnabled" -Value 0 -Type DWord -Force
Set-ItemProperty -Path $hpdUserPath -Name "WakeOnApproachEnabled" -Value 0 -Type DWord -Force
Write-Host "[OK] Presence Sensing (user) disabled" -ForegroundColor Green

# Attention-aware dimming
$attPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\AttentionAwareDimming"
if (-not (Test-Path $attPath)) { New-Item -Path $attPath -Force | Out-Null }
Set-ItemProperty -Path $attPath -Name "AttentionAwareDimmingEnabled" -Value 0 -Type DWord -Force
Write-Host "[OK] Attention-aware dimming disabled" -ForegroundColor Green

# Screen Saver
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive" -Value "0" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaverIsSecure" -Value "0" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveTimeOut" -Value "0" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "SCRNSAVE.EXE" -Value "" -Force
Write-Host "[OK] Screen Saver and lock-on-resume disabled" -ForegroundColor Green

# Intel Graphics startup (user hive)
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "igfxTray" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "IntelGraphicsSoftware" -ErrorAction SilentlyContinue
Write-Host "[OK] Intel Graphics user startup entries removed" -ForegroundColor Green

# Kill Intel Graphics overlay
Stop-Process -Name "IntelGraphicsSoftware" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "IntelGraphicsSoftware.Overlay" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "IGCCTray" -Force -ErrorAction SilentlyContinue
Write-Host "[OK] Intel Graphics overlay processes stopped" -ForegroundColor Green

Write-Host ""
Write-Host "User-level fixes applied." -ForegroundColor Green
Write-Host "Now applying power config fixes..." -ForegroundColor Cyan

# Power config (most of these work without admin)
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS SBUTTONACTION 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS SBUTTONACTION 0
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 30
powercfg /change monitor-timeout-dc 15
powercfg /change hibernate-timeout-ac 0
powercfg /change hibernate-timeout-dc 0
powercfg /setacvalueindex SCHEME_CURRENT 238c9fa8-0aad-41ed-83f4-97be242c8f20 7bc4a2f9-d8fc-4469-b07b-33eb785aaca0 0
powercfg /setdcvalueindex SCHEME_CURRENT 238c9fa8-0aad-41ed-83f4-97be242c8f20 7bc4a2f9-d8fc-4469-b07b-33eb785aaca0 0
powercfg /setacvalueindex SCHEME_CURRENT 7516b95f-f776-4464-8c53-06167f40cc99 8EC4B3A5-6868-48c2-BE75-4F3044BE88A7 0
powercfg /setdcvalueindex SCHEME_CURRENT 7516b95f-f776-4464-8c53-06167f40cc99 8EC4B3A5-6868-48c2-BE75-4F3044BE88A7 0
powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP AWAYMODE 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_SLEEP AWAYMODE 0
powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP HYBRIDSLEEP 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_SLEEP HYBRIDSLEEP 0
powercfg /setacvalueindex SCHEME_CURRENT SUB_VIDEO ADAPTBRIGHT 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_VIDEO ADAPTBRIGHT 0
powercfg /setactive SCHEME_CURRENT

Write-Host "[OK] All power config changes applied:" -ForegroundColor Green
Write-Host "  - Lid close -> Do nothing" -ForegroundColor Gray
Write-Host "  - Sleep button -> Do nothing" -ForegroundColor Gray
Write-Host "  - Sleep timeout -> Never" -ForegroundColor Gray
Write-Host "  - Unattended sleep -> Disabled" -ForegroundColor Gray
Write-Host "  - Console lock timeout -> Disabled" -ForegroundColor Gray
Write-Host "  - Adaptive brightness -> Disabled" -ForegroundColor Gray
Write-Host ""
Write-Host "DONE. Run RUN_FIX_EVERYTHING.bat as Admin for registry-level display flicker fixes." -ForegroundColor Yellow
