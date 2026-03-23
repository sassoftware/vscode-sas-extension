function GetInteropDirectory {
  # try to load from user specified path first
  if ("$($global:interopLibraryFolderPath)") {
    if (Test-Path -Path "$($global:interopLibraryFolderPath)\\SASInterop.dll") {
      return "$($global:interopLibraryFolderPath)"
    }
  }

  # try to load path from registry
  try {
    $pathFromRegistry = (Get-ItemProperty -ErrorAction Stop -Path "HKLM:\\SOFTWARE\\WOW6432Node\\SAS Institute Inc.\\Common Data\\Shared Files\\Integration Technologies").Path
    if (Test-Path -Path "$pathFromRegistry\\SASInterop.dll") {
      return $pathFromRegistry
    }
  } catch {
  }

  # try to load path from integration technologies
  $itcPath = "C:\\Program Files\\SASHome\\x86\\Integration Technologies"
  if (Test-Path -Path "$itcPath\\SASInterop.dll") {
    return $itcPath
  }

  return ""
}

Export-ModuleMember -Function GetInteropDirectory