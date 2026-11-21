<# : batch portion (cmd runs these lines; PowerShell treats them as a comment)
@echo off
set "AMZAP_SELF=%~f0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression ([IO.File]::ReadAllText($env:AMZAP_SELF))"
echo.
pause
exit /b
#>

# AMZAP Asset - machine specs (Windows)
# Reads this computer's hardware details and copies them to the clipboard.
# Paste them on the asset edit page with "Paste from script". Nothing is sent anywhere.

$ErrorActionPreference = 'SilentlyContinue'

function Clean([string]$value) {
  if ($null -eq $value) { return '' }
  return ($value -replace '\s+', ' ').Trim()
}

$bios = Get-CimInstance Win32_BIOS
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'

# Serial (ignore placeholder values from some motherboards)
$serial = Clean $bios.SerialNumber
if ($serial -match 'O\.E\.M|Default string|System Serial|^0+$|^N/?A$') { $serial = '' }

# Operating system, e.g. "Windows 11 Pro 24H2 (build 26100.2314)"
$osText = Clean ($os.Caption -replace '^Microsoft ', '')
if ($cv.DisplayVersion) { $osText += " $($cv.DisplayVersion)" }
if ($os.BuildNumber) {
  $build = "$($os.BuildNumber)"
  if ($null -ne $cv.UBR) { $build += ".$($cv.UBR)" }
  $osText += " (build $build)"
}

# RAM in GB (sum of installed modules)
$ramBytes = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
if (-not $ramBytes) { $ramBytes = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory }
$ramGb = $null
if ($ramBytes) { $ramGb = [math]::Round($ramBytes / 1GB, 2) }

# Storage in GB as printed on the disk label (internal disks only)
$diskBytes = (Get-CimInstance Win32_DiskDrive |
  Where-Object { $_.InterfaceType -ne 'USB' -and $_.MediaType -notmatch 'Removable|External' } |
  Measure-Object -Property Size -Sum).Sum
$storageGb = $null
if ($diskBytes) { $storageGb = [math]::Round($diskBytes / 1e9) }

# IP of the adapter that has the default route
$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1
$ip = ''
if ($route) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.ifIndex |
    Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
}

# MAC: Wi-Fi first; if there is no Wi-Fi, the adapter in use
$wifi = Get-NetAdapter -Physical |
  Where-Object { $_.PhysicalMediaType -match '802\.11' -or $_.NdisPhysicalMedium -eq 9 } |
  Sort-Object { $_.Status -ne 'Up' } | Select-Object -First 1
$macAdapter = $wifi
$macSource = 'Wi-Fi'
if (-not $macAdapter -and $route) {
  $macAdapter = Get-NetAdapter -InterfaceIndex $route.ifIndex
  $macSource = 'adapter in use'
}
$mac = ''
if ($macAdapter) {
  # PermanentAddress = hardware MAC, not a random per-network address
  $mac = Clean $macAdapter.PermanentAddress
  if (-not $mac) { $mac = Clean $macAdapter.MacAddress }
  $hex = $mac -replace '[^0-9A-Fa-f]', ''
  if ($hex.Length -eq 12) { $mac = (($hex.ToUpper() -split '(..)') -ne '') -join ':' }
}

# Screen size (inches, from the size the monitor reports) and resolution
$screen = ''
$monitor = Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorBasicDisplayParams |
  Where-Object { $_.Active -and $_.MaxHorizontalImageSize -gt 0 } | Select-Object -First 1
if ($monitor) {
  $w = [double]$monitor.MaxHorizontalImageSize
  $h = [double]$monitor.MaxVerticalImageSize
  $screen = '{0:0.0}"' -f ([math]::Sqrt($w * $w + $h * $h) / 2.54)
}
$video = Get-CimInstance Win32_VideoController |
  Where-Object { $_.CurrentHorizontalResolution } | Select-Object -First 1
$resolution = ''
if ($video) { $resolution = "$($video.CurrentHorizontalResolution)x$($video.CurrentVerticalResolution)" }

# ---------------- Software: Microsoft Office ----------------
$uninstall = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
$knownOffice = @{
  'O365ProPlusRetail'      = 'Microsoft 365 Apps for enterprise'
  'O365BusinessRetail'     = 'Microsoft 365 Apps for business'
  'O365SmallBusPremRetail' = 'Microsoft 365 Business Premium'
  'O365HomePremRetail'     = 'Microsoft 365 Family/Personal'
  'O365AppsBasicRetail'    = 'Microsoft 365 Basic'
}
$officeNames = @()
$officeLicenses = @()
$officeVersion = ''

# Click-to-Run (Microsoft 365, Office 2016 and later)
$c2r = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration'
if ($c2r.ProductReleaseIds) {
  $ids = $c2r.ProductReleaseIds -split ',' | ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and $_ -notmatch 'LanguagePack|Proofing|Language' }
  foreach ($id in $ids) {
    if ($knownOffice.ContainsKey($id)) { $name = $knownOffice[$id] }
    else {
      $entry = $uninstall | Where-Object { $_.PSChildName -like "$id*" -and $_.DisplayName } | Select-Object -First 1
      if ($entry) { $name = $entry.DisplayName -replace '\s+-\s+[a-z]{2}-[a-z]{2}$', '' } else { $name = $id }
    }
    $officeNames += $name
    if ($id -like 'O365*') { $officeLicenses += 'Subscription (Microsoft 365)' }
    elseif ($id -match 'Volume$') { $officeLicenses += 'Volume' }
    elseif ($id -match 'Retail$') { $officeLicenses += 'Retail' }
  }
  if ($c2r.VersionToReport) {
    $officeVersion = $c2r.VersionToReport
    if ($c2r.Platform) { $officeVersion += " ($($c2r.Platform))" }
  }
}

# Older MSI installs (Office 2010 / 2013 / 2016 MSI)
if (-not $officeNames) {
  $msi = $uninstall | Where-Object {
    $_.DisplayName -match '^Microsoft Office (Professional|Standard|Home|Small Business|Enterprise)' -and
    $_.DisplayName -notmatch 'Proofing|Language|MUI|Component'
  }
  foreach ($entry in $msi) {
    $officeNames += $entry.DisplayName
    if (-not $officeVersion -and $entry.DisplayVersion) { $officeVersion = $entry.DisplayVersion }
  }
}

# Signed-in Microsoft 365 account(s) for the current Windows user
$emails = @()
$licensing = 'HKCU:\Software\Microsoft\Office\16.0\Common\Licensing'
foreach ($key in Get-ChildItem "$licensing\OlsToken\Identity") {
  $emails += (Get-ItemProperty $key.PSPath).emailAddress
}
$mapping = Get-ItemProperty "$licensing\LicensingNext\LicenseIdToEmailMapping"
if ($mapping) {
  $emails += $mapping.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object { "$($_.Value)" }
}
foreach ($key in Get-ChildItem 'HKCU:\Software\Microsoft\Office\16.0\Common\Identity\Identities') {
  $emails += (Get-ItemProperty $key.PSPath).EmailAddress
}
$officeAccount = (@($emails | ForEach-Object { Clean $_ } |
  Where-Object { $_ -match '^[^@\s]+@[^@\s]+\.[^@\s]+$' } |
  ForEach-Object { $_.ToLower() } | Sort-Object -Unique)) -join ', '

# ---------------- Software: Windows activation ----------------
$windowsActivation = ''
$winLicense = Get-CimInstance SoftwareLicensingProduct -Filter "ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL" |
  Sort-Object LicenseStatus | Where-Object { $_.LicenseStatus -eq 1 } | Select-Object -First 1
if (-not $winLicense) {
  $winLicense = Get-CimInstance SoftwareLicensingProduct -Filter "ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL" |
    Select-Object -First 1
}
if ($winLicense) {
  $statusText = @{ 0 = 'Not activated'; 1 = 'Activated'; 2 = 'Grace period'; 3 = 'Grace period'; 4 = 'Not genuine'; 5 = 'Not activated (notification)'; 6 = 'Grace period' }[[int]$winLicense.LicenseStatus]
  if (-not $statusText) { $statusText = "Status $($winLicense.LicenseStatus)" }
  $channel = ''
  if ($winLicense.Description -match '(\w+) channel') {
    $raw = $Matches[1]
    if ($raw -like 'OEM*') { $channel = 'OEM' }
    elseif ($raw -eq 'RETAIL') { $channel = 'Retail' }
    elseif ($raw -like 'VOLUME_KMS*') { $channel = 'Volume KMS' }
    elseif ($raw -like 'VOLUME_MAK*') { $channel = 'Volume MAK' }
    else { $channel = $raw }
  }
  $windowsActivation = $statusText
  if ($channel) { $windowsActivation += " ($channel)" }
}

$specs = [ordered]@{
  amzapSpecs      = 1
  serialNumber    = $serial
  hostname        = Clean $env:COMPUTERNAME
  ipAddress       = Clean $ip
  macAddress      = $mac
  operatingSystem = $osText
  cpu             = Clean $cpu.Name
  ramGb           = $ramGb
  storageGb       = $storageGb
  biosFirmware    = Clean "$($bios.Manufacturer) $($bios.SMBIOSBIOSVersion)"
  screenSize      = $screen
  resolution      = $resolution
  officeProduct     = (@($officeNames | Sort-Object -Unique)) -join ', '
  officeVersion     = Clean $officeVersion
  officeLicense     = (@($officeLicenses | Sort-Object -Unique)) -join ', '
  officeAccount     = $officeAccount
  windowsActivation = $windowsActivation
}

Write-Host ''
Write-Host 'AMZAP Asset - machine specs' -ForegroundColor Cyan
Write-Host '----------------------------------------'
Write-Host ('Serial Number    : ' + $specs.serialNumber)
Write-Host ('Hostname         : ' + $specs.hostname)
Write-Host ('IP Address       : ' + $specs.ipAddress)
Write-Host ('MAC Address      : ' + $specs.macAddress + ' (' + $macSource + ')')
Write-Host ('Operating System : ' + $specs.operatingSystem)
Write-Host ('CPU              : ' + $specs.cpu)
Write-Host ('RAM (GB)         : ' + $specs.ramGb)
Write-Host ('Storage (GB)     : ' + $specs.storageGb)
Write-Host ('BIOS / Firmware  : ' + $specs.biosFirmware)
Write-Host ('Screen Size      : ' + $specs.screenSize)
Write-Host ('Resolution       : ' + $specs.resolution)
Write-Host '-- Software ----------------------------'
Write-Host ('Office Product   : ' + $specs.officeProduct)
Write-Host ('Office Version   : ' + $specs.officeVersion)
Write-Host ('Office License   : ' + $specs.officeLicense)
Write-Host ('Office Account   : ' + $specs.officeAccount)
Write-Host ('Windows Activ.   : ' + $specs.windowsActivation)
Write-Host '----------------------------------------'

$json = $specs | ConvertTo-Json -Compress
Set-Clipboard -Value $json
Write-Host 'Copied to clipboard.' -ForegroundColor Green
Write-Host 'Open this asset''s edit page and click the blue "paste from script" button.'
