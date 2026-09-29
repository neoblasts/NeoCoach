Get-Service | Where-Object { 
    $_.DisplayName -match "Infinix|ControlCenter|OEM|Vantage|Lenovo|Power|HotKey|Sensor|Proximity|Human" -or
    $_.Name -match "Infinix|ControlCenter|OEM|Vantage|Lenovo|Power|HotKey|Sensor|Proximity|Human"
} | Select-Object Name, DisplayName, Status, StartType | Format-Table -Wrap -AutoSize
