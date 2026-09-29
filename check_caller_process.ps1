# Diagnostic for exact process/driver hook on SetSuspendState
Write-Host "Checking Power Transitions (Event 187)..." -ForegroundColor Cyan
Get-WinEvent -FilterHashtable @{LogName='System'; Id=187} -MaxEvents 5 -ErrorAction SilentlyContinue | ForEach-Object {
    [PSCustomObject]@{
        Time = $_.TimeCreated
        CallerProcess = ($_.Properties[0].Value)
        TargetState = ($_.Properties[1].Value)
        RawXml = $_.ToXml()
    }
} | Format-List
