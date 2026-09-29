Get-ChildItem -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run", "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue | ForEach-Object {
    $path = $_.PSPath
    $_.Property | ForEach-Object {
        [PSCustomObject]@{
            Location = $path
            Name = $_
            Value = (Get-ItemProperty $path).$_
        }
    }
} | Format-Table -Wrap -AutoSize
