// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ERROR_END_TAG,
  ERROR_START_TAG,
  WORK_DIR_END_TAG,
  WORK_DIR_START_TAG,
} from "./const";
import { LineCodes } from "./types";

type ScriptProperties = {
  interopLibraryFolderPath?: string;
};

export const getScript = ({
  interopLibraryFolderPath = "",
}: ScriptProperties) => `
using namespace System.Collections.Generic
function GetInteropDirectory {
  # try to load from user specified path first
  if ("${interopLibraryFolderPath}") {
    if (Test-Path -Path "${interopLibraryFolderPath}\\SASInterop.dll") {
      return "${interopLibraryFolderPath}"
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

try {
  $interopDir = GetInteropDirectory
  Add-Type -Path "$interopDir\\SASInterop.dll"
  Add-Type -Path "$interopDir\\SASOManInterop.dll"
} catch {
  Write-Error "${ERROR_START_TAG}LoadingInterop error: $_${ERROR_END_TAG}"
}

class SASRunner{
  [System.__ComObject] $objSAS
  [System.__ComObject] $objKeeper
  [System.__ComObject] $dataConnection

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

        $this.objKeeper = New-Object -ComObject SASObjectManager.ObjectKeeper
        $this.objKeeper.AddObject(1, "WorkspaceObject", $this.objSAS)

        $this.dataConnection = New-Object -comobject ADODB.Connection
        $this.dataConnection.Provider = "sas.IOMProvider"
        $this.dataConnection.Properties("SAS Workspace ID") = $this.objSAS.UniqueIdentifier 
        $this.dataConnection.Properties("Data Source") = "Data Source Name"
        $this.dataConnection.Properties("SAS Port") = $port
        $this.dataConnection.Properties("SAS Machine DNS Name") = $profileHost
        $this.dataConnection.Properties("SAS Protocol") = $protocol
        $this.dataConnection.Properties("User ID") = $username
        $this.dataConnection.Properties("Password") = $password
        $this.dataConnection.Open()

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
        $this.dataConnection.Close()
        $this.objKeeper.RemoveObject($this.objSAS)
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
  
  [void]GetDatasetRecords([string]$tableName, [int]$start = 0, [int]$limit = 100) {
    $objRecordSet = New-Object -comobject ADODB.Recordset
    $objRecordSet.ActiveConnection = $this.dataConnection # This is needed to set the properties for sas formats.
    $objRecordSet.Properties.Item("SAS Formats").Value = "_ALL_"

    $objRecordSet.Open(
      $tableName, 
      [System.Reflection.Missing]::Value, # Use the active connection
      2,  # adOpenDynamic
      1,  # adLockReadOnly
      512 # adCmdTableDirect
    )

    $records = [List[List[object]]]::new()
    $fields = $objRecordSet.Fields.Count
    $objRecordSet.AbsolutePosition = $start + 1

    for ($j = 0; $j -lt $limit -and $objRecordSet.EOF -eq $False; $j++) {
      $cell = [List[object]]::new()
      for ($i = 0; $i -lt $fields; $i++) {
        $cell.Add($objRecordSet.Fields.Item($i).Value)
      }
      $records.Add($cell)
      $objRecordSet.MoveNext()
    }
    $objRecordSet.Close()

    $objRecordSet.Open(
      "SELECT COUNT(1) FROM $tableName", 
      $this.dataConnection, 3, 1, 1
    ) # adOpenStatic, adLockReadOnly, adCmdText
    $count = $objRecordSet.Fields.Item(0).Value
    $objRecordSet.Close()

    $result = New-Object psobject
    $result | Add-Member -MemberType NoteProperty -Name "rows" -Value $records
    $result | Add-Member -MemberType NoteProperty -Name "count" -Value $count

    Write-Host $($result | ConvertTo-Json -Depth 10)
  }
}
`;
