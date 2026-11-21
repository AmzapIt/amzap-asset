#!/bin/bash
# AMZAP Asset - machine specs (macOS)
# Run in Terminal:  bash ~/Downloads/amzap-specs-mac.sh
# Reads this Mac's hardware details and copies them to the clipboard.
# Paste them on the asset edit page with "Paste from script". Nothing is sent anywhere.

hw=$(system_profiler SPHardwareDataType 2>/dev/null)
field() { printf '%s\n' "$hw" | awk -F': ' -v k="$1" 'index($1, k) {print $2; exit}' | sed 's/^ *//; s/ *$//'; }

serial=$(field "Serial Number")
firmware=$(field "System Firmware Version")
[ -z "$firmware" ] && firmware=$(field "Boot ROM Version")
[ -n "$firmware" ] && firmware="Apple $firmware"

host=$(scutil --get LocalHostName 2>/dev/null || hostname -s)
cpu=$(sysctl -n machdep.cpu.brand_string 2>/dev/null)
os="macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion))"

ram=""
mem_bytes=$(sysctl -n hw.memsize 2>/dev/null)
[ -n "$mem_bytes" ] && ram=$(( mem_bytes / 1073741824 ))

# Internal disk size in GB as printed on the label
storage=""
disk_bytes=$(diskutil info disk0 2>/dev/null | sed -n 's/.*Disk Size:.*(\([0-9]*\) Bytes).*/\1/p' | head -1)
[ -n "$disk_bytes" ] && storage=$(( (disk_bytes + 500000000) / 1000000000 ))

# IP of the interface with the default route
default_if=$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}')
ip=""
[ -n "$default_if" ] && ip=$(ipconfig getifaddr "$default_if" 2>/dev/null)

# MAC: Wi-Fi first (hardware address, not the private per-network one)
wifi_dev=$(networksetup -listallhardwareports 2>/dev/null | awk '/Hardware Port: (Wi-Fi|AirPort)/ {getline; print $2; exit}')
mac_dev=${wifi_dev:-$default_if}
mac_source="Wi-Fi"
[ -z "$wifi_dev" ] && mac_source="adapter in use"
mac=""
[ -n "$mac_dev" ] && mac=$(networksetup -getmacaddress "$mac_dev" 2>/dev/null | awk '{print $3}')

resolution=$(system_profiler SPDisplaysDataType 2>/dev/null | awk -F': ' '/Resolution:/ {print $2; exit}' | sed -E 's/^([0-9]+) x ([0-9]+).*/\1x\2/')

# Software: Microsoft Office (best effort on macOS; license type is usually not readable)
office_product=""
office_version=""
office_license=""
office_account=""
for app in "Microsoft Word" "Microsoft Excel" "Microsoft PowerPoint" "Microsoft Outlook"; do
  plist="/Applications/$app.app/Contents/Info.plist"
  if [ -f "$plist" ]; then
    office_product="Microsoft Office for Mac"
    office_version=$(defaults read "/Applications/$app.app/Contents/Info" CFBundleShortVersionString 2>/dev/null)
    break
  fi
done
[ -f /Library/Preferences/com.microsoft.office.licensingV2.plist ] && office_license="Volume"
office_account=$(defaults read com.microsoft.office OfficeActivationEmailAddress 2>/dev/null)
if [ -z "$office_account" ]; then
  office_account=$(defaults read "$HOME/Library/Group Containers/UBF8T346G9.Office/com.microsoft.officeprefs" OfficeActivationEmailAddress 2>/dev/null)
fi
case "$office_account" in *@*) ;; *) office_account="" ;; esac

esc() { printf '%s' "$1" | tr -d '\r\n\t' | sed 's/\\/\\\\/g; s/"/\\"/g'; }

json=$(printf '{"amzapSpecs":1,"serialNumber":"%s","hostname":"%s","ipAddress":"%s","macAddress":"%s","operatingSystem":"%s","cpu":"%s","ramGb":"%s","storageGb":"%s","biosFirmware":"%s","screenSize":"","resolution":"%s","officeProduct":"%s","officeVersion":"%s","officeLicense":"%s","officeAccount":"%s","windowsActivation":""}' \
  "$(esc "$serial")" "$(esc "$host")" "$(esc "$ip")" "$(esc "$mac")" "$(esc "$os")" \
  "$(esc "$cpu")" "$(esc "$ram")" "$(esc "$storage")" "$(esc "$firmware")" "$(esc "$resolution")" \
  "$(esc "$office_product")" "$(esc "$office_version")" "$(esc "$office_license")" "$(esc "$office_account")")

echo ""
echo "AMZAP Asset - machine specs"
echo "----------------------------------------"
echo "Serial Number    : $serial"
echo "Hostname         : $host"
echo "IP Address       : $ip"
echo "MAC Address      : $mac ($mac_source)"
echo "Operating System : $os"
echo "CPU              : $cpu"
echo "RAM (GB)         : $ram"
echo "Storage (GB)     : $storage"
echo "BIOS / Firmware  : $firmware"
echo "Screen Size      : (enter manually)"
echo "Resolution       : $resolution"
echo "-- Software ----------------------------"
echo "Office Product   : $office_product"
echo "Office Version   : $office_version"
echo "Office License   : ${office_license:-(enter manually)}"
echo "Office Account   : $office_account"
echo "----------------------------------------"

printf '%s' "$json" | pbcopy
echo "Copied to clipboard."
echo "Open this asset's edit page and click \"Paste from script\"."
