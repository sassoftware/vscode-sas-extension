// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ERROR_END_TAG,
  ERROR_START_TAG,
  WORK_DIR_END_TAG,
  WORK_DIR_START_TAG,
} from "./const";
import { LineCodes } from "./types";

export const scriptContent = `
class SASRunner{
  [System.__ComObject] $objSAS

  SASRunner([string]$interopPath) {
    try {
      $interopDir = $this.GetInteropDirectory($interopPath)
      Add-Type -Path "$interopDir\\SASInterop.dll"
      Add-Type -Path "$interopDir\\SASOManInterop.dll"
    } catch {
      Write-Error "${ERROR_START_TAG}LoadingInterop error: $_${ERROR_END_TAG}"
    }
  }

  [string] GetInteropDirectory([string]$defaultInteropPath) {
    # try to load from user specified path first
    if ($defaultInteropPath) {
      if (Test-Path -Path "$defaultInteropPath\\SASInterop.dll") {
        return $defaultInteropPath
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

  [void]ResolveSystemVars(){
    try {
      Write-Host "${WORK_DIR_START_TAG}"
      Write-Host $this.GetWorkDir()
      Write-Host "${WORK_DIR_END_TAG}"
    } catch {
      Write-Error "${ERROR_START_TAG}Setup error: $_${ERROR_END_TAG}"
    }
  }

  [void]Setup([string]$profileHost, [string]$username, [string]$password, [int]$port, [int]$protocol, [string]$serverName, [string]$displayLang) {
    try {
        # Set Encoding for input and output
        $OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding

        # create the Integration Technologies objects
        $objFactory = New-Object -TypeName SASObjectManager.ObjectFactoryMulti2Class
        $objFactory.ApplicationName = "SAS Extension for Visual Studio Code"
        $objServerDef = New-Object -TypeName SASObjectManager.ServerDefClass
        $objServerDef.MachineDNSName = $profileHost # SAS Workspace node
        $objServerDef.Port = $port # workspace server port
        $objServerDef.Protocol = $protocol # 0 = COM protocol
        $sasLocale = $displayLang -replace '-', '_'
        $objServerDef.ExtraNameValuePairs="LOCALE=$sasLocale" # set the correct locale

        # Class Identifier for SAS Workspace
        $objServerDef.ClassIdentifier = "440196d4-90f0-11d0-9f41-00a024bb830c"

        # create and connect to the SAS session
        $this.objSAS = $objFactory.CreateObjectByServer(
            $serverName, # server name
            $true,
            $objServerDef, # built server definition
            $username,
            $password
        )

        Write-Host "${LineCodes.SessionCreatedCode}"
    } catch {
      Write-Error "${ERROR_START_TAG}Setup error: $_${ERROR_END_TAG}"
    }
  }

  [void]SetOptions([array] $sasOptions) {
    $names = [string[]]@()
    $values = [string[]]@()

    foreach ($item in $sasOptions) {
        $parts = $item -split '=| '
        $names += $parts[0] -replace '^-'
        if ($parts.Length -gt 1) {
            $values += $parts[1]
        } else {
            $values += ""
        }
    }

    [ref]$errorIndices = [int[]]::new($names.Length)
    [ref]$errors = [string[]]::new($names.Length)
    [ref]$errorCodes = [int[]]::new($names.Length)

    try{
      $this.objSAS.Utilities.OptionService.SetOptions([string[]]$names, [string[]]$values, $errorIndices, $errorCodes, $errors)

      $errVals = $errors.Value
      if($errVals.Length -gt 0){
          throw $errVals
      }
    } catch{
        Write-Error "${ERROR_START_TAG}$Error[0].Exception.Message${ERROR_END_TAG}"
    }
  }

  [string]GetWorkDir() {
    $fieldInclusionMask = ($false, $false, $false, $true, $false)
    [ref]$engineName = [string[]]@()
    [ref]$engineAttrs = New-Object 'int[,]' 0,0
    [ref]$libraryAttrs = [int[]]@()
    [ref]$physicalName = [string[]]::new(1)
    [ref]$infoPropertyNames = New-Object 'string[,]' 0,0
    [ref]$infoPropertyValues = New-Object 'string[,]' 0,0
    $lib = $this.objSAS.DataService.UseLibref("work")
    $lib.LevelInfo([bool[]]$fieldInclusionMask,$engineName,$engineAttrs,$libraryAttrs,
                  $physicalName,$infoPropertyNames,$infoPropertyValues)
    return $physicalName.Value[0]
  }

  [void]Run([string]$code) {
    try{
        $this.objSAS.LanguageService.Reset()
        $this.objSAS.LanguageService.Async = $true
        $this.objSAS.LanguageService.Submit($code)
    }catch{
      Write-Error "${ERROR_START_TAG}Run error: $_${ERROR_END_TAG}"
    }
  }

  [void]Close(){
  try{
        $this.objSAS.Close()
    }catch{
      Write-Error "${ERROR_START_TAG}Close error: $_${ERROR_END_TAG}"
    }
  }

  [void]Cancel(){
  try{
        $this.objSAS.LanguageService.Cancel()
        Write-Host "${LineCodes.RunCancelledCode}"
      }catch{
        Write-Error "${ERROR_START_TAG}Cancel error: $_${ERROR_END_TAG}"
      }
    }

  [String]FlushLog([int]$chunkSize) {
      try{
        return $this.objSAS.LanguageService.FlushLog($chunkSize)
      } catch{
        Write-Error "${ERROR_START_TAG}FlushLog error: $_${ERROR_END_TAG}"
      }
      return ""
  }

  [int]FlushLogLines([int]$chunkSize,[bool]$skipPageHeader) {
    [ref]$carriageControls = [int[]]::new($chunkSize)
    [ref]$lineTypes = [int[]]::new($chunkSize)
    [ref]$logLines = [string[]]::new($chunkSize)

    try{
      $this.objSAS.LanguageService.FlushLogLines($chunkSize,$carriageControls,$lineTypes,$logLines)
    } catch{
      Write-Error "${ERROR_START_TAG}FlushLog error: $_${ERROR_END_TAG}"
    }
    for ($i = 0; $i -lt $logLines.Value.Length; $i++) {
      if (($carriageControls.Value[$i] -eq 1) -and $skipPageHeader) {
        continue
      }
      Write-Host "${LineCodes.LogLineType}" $lineTypes.Value[$i]
      Write-Host $logLines.Value[$i]
    }
    return $logLines.Value.Length
  }

  [void]FlushCompleteLog(){
    do {
      $chunkSize = 32768
      $log = $this.FlushLog($chunkSize)
      Write-Host $log
    } while ($log.Length -gt 0)
  }

  [void]FetchResultsFile([string]$filePath, [string]$outputFile) {
    $fileRef = ""
    $objFile = $this.objSAS.FileService.AssignFileref("", "DISK", $filePath, "", [ref] $fileRef)
    $objStream = $objFile.OpenBinaryStream(1);
    [Byte[]] $bytes = 0x0

    $endOfFile = $false
    $byteCount = 0
    $outStream = New-Object System.IO.FileStream($outputFile, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::Write)
    try {
      do
      {
        $objStream.Read(8192, [ref] $bytes)
        $outStream.Write($bytes, 0, $bytes.length)
        $endOfFile = $bytes.Length -lt 8192
        $byteCount = $byteCount + $bytes.Length
      } while (-not $endOfFile)
    } finally {
      $objStream.Close()
      $outStream.Close()
      $this.objSAS.FileService.DeassignFileref($objFile.FilerefName)
    }

    Write-Host "${LineCodes.ResultsFetchedCode}"
  }

  [void]DeleteItemAtPath([string]$filePath,[bool]$recursive) {
    if ($recursive) {
      $items = $this.GetItemsAtPath($filePath);
      for($i = 0; $i -lt $items.Count; $i++) {
        if ($items[$i].category -eq 0) {
          $this.DeleteItemAtPath($items[$i].uri, $true);
        } else {
          $this.DeleteItemAtPath($items[$i].uri, $false);
        }
      }
      $this.objSAS.FileService.DeleteFile($filePath)
    } else {
      $this.objSAS.FileService.DeleteFile($filePath)
    }
  }

  [void]DeleteFile([string]$filePath,[bool]$recursive) {
    $this.DeleteItemAtPath($filePath, $recursive)
    write-Host ("done" | ConvertTo-Json)
  }

  [void]CreateDirectory([string]$folderPath, [string]$folderName) {
    $uri = $this.objSAS.FileService.MakeDirectory($folderPath, $folderName)
    write-Host (@{uri=$uri} | ConvertTo-Json)
  }

  [void]CreateFile([string]$folderPath, [string]$fileName, [string]$localFilePath) {
    $fileRefName = ""
    $objFile = $this.objSAS.FileService.AssignFileref("", "DISK", $folderPath, "", [ref] $fileRefName)
    $assignedName = ""
    $outFile = $objFile.AssignMember("", $fileName, "DISK", "", [ref] $assignedName)
    $objStream = $outFile.OpenBinaryStream([SAS.StreamOpenMode]::StreamOpenModeForWriting);
    if ($localFilePath) {
      $fileContent = (Get-Content -Path $localFilePath -Raw)
      $objStream.Write($fileContent)
    }
    $objStream.Close()
    $this.objSAS.FileService.DeassignFileref($outFile.FilerefName)
    $this.objSAS.FileService.DeassignFileref($objFile.FilerefName)

    Write-Host ("done" | ConvertTo-Json)
  }

  [void]UpdateFile([string]$filePath, [string]$content) {
    $fileRefName = ""
    $objFile = $this.objSAS.FileService.AssignFileref("", "DISK", $filePath, "", [ref] $fileRefName)
    $objStream = $objFile.OpenTextStream([SAS.StreamOpenMode]::StreamOpenModeForWriting, 27994);
    $objStream.Write($content);

    $objStream.Close()
    $this.objSAS.FileService.DeassignFileref($objFile.FilerefName)

    Write-Host ("done" | ConvertTo-Json)
  }

  [void]RenameFile([string]$oldPath,[string]$newPath,[string]$newName) {
    $this.objSAS.FileService.RenameFile($oldPath,$newPath+"\\"+$newName);
    $items = $this.GetItemsAtPath($newPath);
    for($i = 0; $i -lt $items.Count; $i++) {
      if ($items[$i].name -eq $newName) {
        Write-Host (ConvertTo-Json -InputObject @($items[$i]))
        break
      }
    }
    Write-Host ""
  }

  [void]FetchFileContent([string]$filePath, [string]$outputFile) {
    $fileRef = ""
    $objFile = $this.objSAS.FileService.AssignFileref("", "DISK", $filePath, "", [ref] $fileRef)
    $objStream = $objFile.OpenBinaryStream(1);
    [Byte[]] $bytes = 0x0

    $endOfFile = $false
    $byteCount = 0
    $outStream = New-Object System.IO.FileStream($outputFile, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::Write)
    try {
      do
      {
        $objStream.Read(8192, [ref] $bytes)
        $outStream.Write($bytes, 0, $bytes.length)
        $endOfFile = $bytes.Length -lt 8192
        $byteCount = $byteCount + $bytes.Length
      } while (-not $endOfFile)
    } finally {
      $objStream.Close()
      $outStream.Close()
      $this.objSAS.FileService.DeassignFileref($objFile.FilerefName)
    }
  }

  [object[]] GetItemsAtPath([string]$folderPath) {
    $fieldInclusionMask = [boolean[]]@()
    # Out data
    $listedPath = ""
    $names = [string[]]@()
    $typeNames = [string[]]@()
    $typeCategories = [SAS.FileRefTypeCategory[]]@()
    $sizes = [int[]]@()
    $modTimes = [DateTime[]]@()
    $engines = [string[]]@()

    $mode = [SAS.FileServiceListFilesMode]::FileServiceListFilesModePath
    if ($folderPath -eq "/") {
      $mode = [SAS.FileServiceListFilesMode]::FileServiceListFilesModeUser
    }

    $this.objSAS.FileService.ListFiles(
        $folderPath,
        $mode,
        $fieldInclusionMask,
        [ref]$listedPath,
        [ref]$names,
        [ref]$typeNames,
        [ref]$typeCategories,
        [ref]$sizes,
        [ref]$modTimes,
        [ref]$engines
    )

    $output = [object[]]::new($names.Length)
    for($i = 0; $i -lt $names.Count; $i++) {
      $output[$i] = @{
        uri=$listedPath + "\\" + $names[$i]
        name=$names[$i];
        type=$typeNames[$i];
        category=$typeCategories[$i];
        size=$sizes[$i];
        modifiedTimeStamp=$modTimes[$i];
        engine=$engines[$i];
        parentFolderUri=$listedPath
      }
    }

    return $output
  }

  [void]GetChildItems([string]$folderPath) {
    $output = $this.GetItemsAtPath($folderPath)
    Write-Host (ConvertTo-Json -InputObject @($output))
  }
}
`;
