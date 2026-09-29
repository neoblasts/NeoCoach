# Diagnostic check for active locking / hook utilities
$windhawkMods = "C:\ProgramData\Windhawk\Engine\Mods"
if (Test-Path $windhawkMods) {
    Write-Host "Windhawk Mods installed:"
    Get-ChildItem $windhawkMods | Select-Object Name
}

# Check Screen Saver timeout registry in User hive
$timeout = (Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name ScreenSaveTimeOut -ErrorAction SilentlyContinue).ScreenSaveTimeOut
$secure = (Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name ScreenSaverIsSecure -ErrorAction SilentlyContinue).ScreenSaverIsSecure
Write-Host "HKCU ScreenSaveTimeOut (seconds): $timeout"
Write-Host "HKCU ScreenSaverIsSecure (1=locks screen): $secure"

# Check Windows LockWorkstation policy
$policy = (Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System' -ErrorAction SilentlyContinue)
Write-Host "Policies\System: $($policy | Out-String)"
