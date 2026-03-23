<#
  Use this script to test itc connections. This imports our itc script and is runnable in
  Powershell in the following way (see optional parameters in "Script setup" region):
  `C:\<scriptPath>\itc-connection-test.ps1 -HostName <host> -Username <user> -Password <password>`

  See a list of optional parameters below.

  Additionally, you can modify code in the "Code to execute" region to fit your testing needs.
#>

#region Script setup
# NOTE: You shouldn't need to edit anything in this region.
param (
  [string] $HostName = "",
  [string] $Port = "8591",
  [string] $Protocol = "2", # IOMBridge
  [string] $Username = "",
  [string] $Password = "",
  [string] $DisplayLang = "EN_US",
  [string] $InteropLibraryPath = ""
)

$global:interopLibraryFolderPath = $InteropLibraryPath

Set-Location "$PSScriptRoot\..\..\client\src\connection\itc\script\"

Import-Module .\GetInteropDirectory.psm1

try {
  $interopDir = GetInteropDirectory
  Add-Type -Path "$interopDir\\SASInterop.dll"
  Add-Type -Path "$interopDir\\SASOManInterop.dll"
} catch {
  Write-Error "$($global:env.Tags.ErrorStartTag)LoadingInterop error: $_$($global:env.Tags.ErrorEndTag)"
}

. ".\itc.ps1"

$runner = New-Object -TypeName SASRunner
$runner.Setup($HostName, $Username, $Password, [int]$Port, [int]$Protocol, "ITC Connection Test", $DisplayLang)
$runner.ResolveSystemVars()
#endregion

#region Code to execute
# Uncomment the following line to set any options
$runner.SetOptions("VALIDVARNAME=ANY")

# Adjust the value of $code as needed
$code = "proc options group=languagecontrol;"
$runner.Run($code)

do {
  $chunkSize = 32768
  $log = $runner.FlushLog($chunkSize)
  Write-Host $log
} while ($log.Length -gt 0)
#endregion
