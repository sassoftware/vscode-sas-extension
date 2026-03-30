using namespace System.Collections.Generic

$global:env = (Get-Content -Path "$PWD\\env.json" -Raw) | ConvertFrom-Json

Import-Module "$PWD\\GetInteropDirectory.psm1"
Import-Module "$PWD\\TableHelpers.psm1"

try {
  $interopDir = GetInteropDirectory
  Add-Type -Path "$interopDir\\SASInterop.dll"
  Add-Type -Path "$interopDir\\SASOManInterop.dll"
} catch {
  Write-Error "$($global:env.Tags.ErrorStartTag)LoadingInterop error: $_$($global:env.Tags.ErrorEndTag)"
}

class SASRunner {
  [System.__ComObject] $objSAS
  [System.__ComObject] $objKeeper
  [System.__ComObject] $dataConnection

  [void]ResolveSystemVars() {
    try {
      Write-Host "$($global:env.Tags.WorkDirStartTag)"
      Write-Host $this.GetWorkDir()
      Write-Host "$($global:env.Tags.WorkDirEndTag)"
    } catch {
      Write-Error "$($global:env.Tags.ErrorStartTag)Setup error: $_$($global:env.Tags.ErrorEndTag)"
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
      $objServerDef.ExtraNameValuePairs = "LOCALE=$sasLocale" # set the correct locale

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
      $this.dataConnection.Properties("Data Source") = (
        "iom-id://" + $this.objSAS.UniqueIdentifier
      )
      $this.dataConnection.Open()

      Write-Host "$($global:env.LineCodes.SessionCreatedCode)"
    } catch {
      Write-Error "$($global:env.Tags.ErrorStartTag)Setup error: $_$($global:env.Tags.ErrorEndTag)"
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

    try {
      $this.objSAS.Utilities.OptionService.SetOptions([string[]]$names, [string[]]$values, $errorIndices, $errorCodes, $errors)

      $errVals = $errors.Value
      if ($errVals.Length -gt 0) {
        throw $errVals
      }
    } catch {
      Write-Error "$($global:env.Tags.ErrorStartTag)$Error[0].Exception.Message$($global:env.Tags.ErrorEndTag)"
    }
  }

  [string]GetWorkDir() {
    $fieldInclusionMask = ($false, $false, $false, $true, $false)
    [ref]$engineName = [string[]]@()
    [ref]$engineAttrs = New-Object 'int[,]' 0, 0
    [ref]$libraryAttrs = [int[]]@()
    [ref]$physicalName = [string[]]::new(1)
    [ref]$infoPropertyNames = New-Object 'string[,]' 0, 0
    [ref]$infoPropertyValues = New-Object 'string[,]' 0, 0
    $lib = $this.objSAS.DataService.UseLibref("work")
    $lib.LevelInfo([bool[]]$fieldInclusionMask, $engineName, $engineAttrs, $libraryAttrs,
      $physicalName, $infoPropertyNames, $infoPropertyValues)
    return $physicalName.Value[0]
  }

  [void]Run([string]$code) {
    try {
      $this.objSAS.LanguageService.Reset()
      $this.objSAS.LanguageService.Async = $true
      $this.objSAS.LanguageService.Submit($code)
    } catch {
      Write-Error "$($global:env.Tags.ErrorStartTag)Run error: $_$($global:env.Tags.ErrorEndTag)"
    }
  }

  [void]Close() {
    try {
      $this.dataConnection.Close()
      $this.objKeeper.RemoveObject($this.objSAS)
      $this.objSAS.Close()
    } catch {
      Write-Error "$($global:env.Tags.ErrorStartTag)Close error: $_$($global:env.Tags.ErrorEndTag)"
    }
  }

  [void]Cancel() {
    try {
      $this.objSAS.LanguageService.Cancel()
      Write-Host "$($global:env.LineCodes.RunCancelledCode)"
    } catch {
      Write-Error "$($global:env.Tags.ErrorStartTag)Cancel error: $_$($global:env.Tags.ErrorEndTag)"
    }
  }

  [String]FlushLog([int]$chunkSize) {
    try {
      return $this.objSAS.LanguageService.FlushLog($chunkSize)
    } catch {
      Write-Error "$($global:env.Tags.ErrorStartTag)FlushLog error: $_$($global:env.Tags.ErrorEndTag)"
    }
    return ""
  }

  [int]FlushLogLines([int]$chunkSize, [bool]$skipPageHeader) {
    [ref]$carriageControls = [int[]]::new($chunkSize)
    [ref]$lineTypes = [int[]]::new($chunkSize)
    [ref]$logLines = [string[]]::new($chunkSize)

    try {
      $this.objSAS.LanguageService.FlushLogLines($chunkSize, $carriageControls, $lineTypes, $logLines)
    } catch {
      Write-Error "$($global:env.Tags.ErrorStartTag)FlushLog error: $_$($global:env.Tags.ErrorEndTag)"
    }
    for ($i = 0; $i -lt $logLines.Value.Length; $i++) {
      if (($carriageControls.Value[$i] -eq 1) -and $skipPageHeader) {
        continue
      }
      Write-Host "$($global:env.LineCodes.LogLineType)" $lineTypes.Value[$i]
      Write-Host $logLines.Value[$i]
    }
    return $logLines.Value.Length
  }

  [void]FlushCompleteLog() {
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
      do {
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

    Write-Host "$($global:env.LineCodes.ResultsFetchedCode)"
  }

  [void]GetDatasetRecords([string]$library, [string]$table, [int]$start = 0, [int]$limit = 100, [string]$sortCriteria = "", [string]$jsonQueryData = "") {
    $objRecordSet = New-Object -comobject ADODB.Recordset
    $objRecordSet.ActiveConnection = $this.dataConnection # This is needed to set the properties for sas formats.
    $objRecordSet.Properties.Item("SAS Formats").Value = "_ALL_"

    $queryParams = $jsonQueryData | ConvertFrom-Json

    $tableName = $library + "." + $table
    if ($sortCriteria -ne "" -or $jsonQueryData -ne "") {
      $view = GetFilteredView -Library $library -Table $table -SortCriteria $sortCriteria -JSONQueryData $jsonQueryData
      $tableName = $view.Name
      $this.dataConnection.Execute($view.Query)
    }

    $objRecordSet.Open(
      $tableName,
      [System.Reflection.Missing]::Value, # Use the active connection
      2,  # adOpenDynamic
      1,  # adLockReadOnly
      512 # adCmdTableDirect
    )

    $records = [List[List[object]]]::new()
    $fields = $objRecordSet.Fields.Count

    if ($objRecordSet.EOF) {
      Write-Host '{"rows": [], "count": 0}'
      return
    }

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

    if ($sortCriteria -ne "") {
      $this.dataConnection.Execute("DROP VIEW $tableName")
    }

    Write-Host $(ConvertTo-Json -Depth 10 -InputObject $result -Compress)
  }

  [void]GetColumns([string]$libname, [string]$memname) {
    $objRecordSet = New-Object -comobject ADODB.Recordset
    $objRecordSet.ActiveConnection = $this.dataConnection
    $query = @"
      select name, type, format, label, length, varnum
      from sashelp.vcolumn
      where libname='$libname' and memname='$memname'
      order by varnum;
"@
    $objRecordSet.Open(
      $query,
      [System.Reflection.Missing]::Value, # Use the active connection
      2, # adOpenDynamic
      1, # adLockReadOnly
      1  # adCmdText
    )

    $rows = $objRecordSet.GetRows()

    $objRecordSet.Close()

    $parsedRows = @()
    for ($i = 0; $i -lt $rows.GetLength(1); $i++) {
      $parsedRow = [PSCustomObject]@{
        index  = $i + 1
        name   = $rows[0, $i]
        type   = $rows[1, $i]
        format = $rows[2, $i]
        label  = $rows[3, $i]
        length = $rows[4, $i]
        varnum = $rows[5, $i]
      }
      $parsedRows += $parsedRow
    }

    Write-Host $(ConvertTo-Json -Depth 10 -InputObject $parsedRows -Compress)
  }

  [void]DeleteItemAtPath([string]$filePath, [bool]$recursive) {
    if ($recursive) {
      $items = $this.GetItemsAtPath($filePath, [SAS.FileServiceListFilesMode]::FileServiceListFilesModePath);
      for ($i = 0; $i -lt $items.Count; $i++) {
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

  [void]DeleteFile([string]$filePath) {
    $recursive = $true
    try {
      # If we error out, that means we're trying to get items at a file path,
      # which isn't valid (thus, this isn't recursive)
      $items = $this.GetItemsAtPath($filePath, [SAS.FileServiceListFilesMode]::FileServiceListFilesModePath);
    } catch {
      $recursive = $false
    }
    try {
      $this.DeleteItemAtPath($filePath, $recursive)
      Write-Host (@{success = $true } | ConvertTo-Json)
    } catch {
      Write-Host (@{success = $false; message = $Error[0].Exception.Message } | ConvertTo-Json)
    }
  }

  [void]CreateDirectory([string]$folderPath, [string]$folderName) {
    try {
      $currentFolder = $this.GetItemAtPathWithName($folderPath, $folderName)
      if ($currentFolder -ne $null) {
        Write-Host (@{success = $false } | ConvertTo-Json)
        return;
      }

      $uri = $this.objSAS.FileService.MakeDirectory($folderPath, $folderName)
      $newFolder = $this.GetItemAtPathWithName($folderPath, $folderName)
      Write-Host (@{success = $true; data = $newFolder } | ConvertTo-Json)
    } catch {
      Write-Host (@{success = $false; message = $Error[0].Exception.Message } | ConvertTo-Json)
    }
  }

  [void]CreateFile([string]$folderPath, [string]$fileName, [string]$content) {
    try {
      $currentItem = $this.GetItemAtPathWithName($folderPath, $fileName)
      if ($currentItem -ne $null) {
        Write-Host (@{success = $false } | ConvertTo-Json)
        return;
      }

      $fileRefName = ""
      $objFile = $this.objSAS.FileService.AssignFileref("", "DISK", $folderPath, "", [ref] $fileRefName)
      $assignedName = ""
      $outFile = $objFile.AssignMember("", $fileName, "DISK", "", [ref] $assignedName)
      $objStream = $outFile.OpenBinaryStream([SAS.StreamOpenMode]::StreamOpenModeForWriting)
      $objStream.Write([System.Convert]::FromBase64String($content));
      $objStream.Close()
      $this.objSAS.FileService.DeassignFileref($outFile.FilerefName)
      $this.objSAS.FileService.DeassignFileref($objFile.FilerefName)

      $newFile = $this.GetItemAtPathWithName($folderPath, $fileName)
      Write-Host (@{success = $true; data = $newFile } | ConvertTo-Json)
    } catch {
      Write-Host (@{success = $false; message = $Error[0].Exception.Message } | ConvertTo-Json)
    }
  }

  [void]UpdateFile([string]$filePath, [string]$content) {
    try {
      $fileRefName = ""
      $objFile = $this.objSAS.FileService.AssignFileref("", "DISK", $filePath, "", [ref] $fileRefName)
      $objStream = $objFile.OpenBinaryStream([SAS.StreamOpenMode]::StreamOpenModeForWriting);
      $encoding = [System.Text.Encoding]::UTF8
      $objStream.Write($encoding.GetBytes($content));

      $objStream.Close()
      $this.objSAS.FileService.DeassignFileref($objFile.FilerefName)

      Write-Host (@{success = $true } | ConvertTo-Json)
    } catch {
      Write-Host (@{success = $false; message = $Error[0].Exception.Message } | ConvertTo-Json)
    }
  }

  [string]GetDirectorySeparator([string]$path) {
    if ($path -Match "/") {
      return "/"
    }

    return "\"
  }

  [void]RenameFile([string]$oldPath, [string]$newPath, [string]$newName) {
    try {
      $currentItem = $this.GetItemAtPathWithName($newPath, $newName)
      if ($currentItem -ne $null) {
        Write-Host (@{success = $false } | ConvertTo-Json)
        return;
      }

      $this.objSAS.FileService.RenameFile($oldPath, $newPath + $this.GetDirectorySeparator($newPath) + $newName);
      $item = $this.GetItemAtPathWithName($newPath, $newName);
      Write-Host (@{success = $true; data = $item } | ConvertTo-Json)
    } catch {
      Write-Host (@{success = $false; message = $Error[0].Exception.Message } | ConvertTo-Json)
    }
  }

  [void]FetchFileContent([string]$filePath, [string]$outputFile) {
    try {
      $fileRef = ""
      $objFile = $this.objSAS.FileService.AssignFileref("", "DISK", $filePath, "", [ref] $fileRef)
      $objStream = $objFile.OpenBinaryStream(1);
      [Byte[]] $bytes = 0x0

      $endOfFile = $false
      $byteCount = 0
      $outStream = New-Object System.IO.FileStream($outputFile, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::Write)
      try {
        do {
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
      Write-Host (@{success = $true } | ConvertTo-Json)
    } catch {
      Write-Host (@{success = $false; message = $Error[0].Exception.Message } | ConvertTo-Json)
    }
  }

  [object] GetItemAtPathWithName([string]$folderPath, [string]$name) {
    $items = $this.GetItemsAtPath($folderPath, [SAS.FileServiceListFilesMode]::FileServiceListFilesModePath)
    for ($i = 0; $i -lt $items.Count; $i++) {
      if ($items[$i].name -eq $name) {
        return $items[$i]
      }
    }
    return $null;
  }

  [object[]] GetItemsAtPath([string]$folderPath, [SAS.FileServiceListFilesMode] $mode) {
    $fieldInclusionMask = [boolean[]]@()
    # Out data
    $listedPath = ""
    $names = [string[]]@()
    $typeNames = [string[]]@()
    $typeCategories = [SAS.FileRefTypeCategory[]]@()
    $sizes = [int[]]@()
    $modTimes = [DateTime[]]@()
    $engines = [string[]]@()

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
    for ($i = 0; $i -lt $names.Count; $i++) {
      $uri = $listedPath.Trim("\\") + $this.GetDirectorySeparator($listedPath) + $names[$i];
      if ($listedPath -eq "") {
        $uri = $names[$i]
      }
      $output[$i] = @{
        uri               = $uri;
        name              = $names[$i];
        type              = $typeNames[$i];
        category          = $typeCategories[$i];
        size              = $sizes[$i];
        modifiedTimeStamp = $modTimes[$i];
        engine            = $engines[$i];
        parentFolderUri   = $listedPath
      }
    }

    return $output
  }

  [void]GetChildItems([string]$folderPath, [string]$fileNavigationCustomRootPath, [string]$fileNavigationRoot) {
    try {
      $mode = [SAS.FileServiceListFilesMode]::FileServiceListFilesModePath
      if ($folderPath -eq "/") {
        if ($fileNavigationRoot -eq "USER") {
          $mode = [SAS.FileServiceListFilesMode]::FileServiceListFilesModeUser
        }
        if ($fileNavigationRoot -eq "SYSTEM") {
          $mode = [SAS.FileServiceListFilesMode]::FileServiceListFilesModePath
        }
        if ($fileNavigationRoot -eq "CUSTOM") {
          $folderPath = $fileNavigationCustomRootPath
          $mode = [SAS.FileServiceListFilesMode]::FileServiceListFilesModePath
        }
      }
      $output = $this.GetItemsAtPath($folderPath, $mode)
      Write-Host (@{success = $true; data = $output } | ConvertTo-Json)
    } catch {
      Write-Host (@{success = $false; message = $Error[0].Exception.Message } | ConvertTo-Json)
    }
  }

  [void]GetLibraries() {
    $objRecordSet = New-Object -comobject ADODB.Recordset
    $objRecordSet.ActiveConnection = $this.dataConnection
    $query = @"
      select distinct libname, readonly
      from sashelp.vlibnam
      order by libname asc;
"@
    $objRecordSet.Open(
      $query,
      [System.Reflection.Missing]::Value, # Use the active connection
      2, # adOpenDynamic
      1, # adLockReadOnly
      1  # adCmdText
    )

    $records = [System.Collections.Generic.List[object[]]]::new()
    while (-not $objRecordSet.EOF) {
      $row = @()
      for ($i = 0; $i -lt $objRecordSet.Fields.Count; $i++) {
        $row += $objRecordSet.Fields.Item($i).Value
      }
      $records.Add($row)
      $objRecordSet.MoveNext()
    }
    $objRecordSet.Close()

    $result = New-Object psobject
    $result | Add-Member -MemberType NoteProperty -Name "libraries" -Value $records
    $result | Add-Member -MemberType NoteProperty -Name "count" -Value $records.Count

    Write-Host $(ConvertTo-Json -Depth 10 -InputObject $result -Compress)
  }

  [void]GetTableInfo([string]$libname, [string]$memname) {
    $objRecordSet = New-Object -comobject ADODB.Recordset
    $objRecordSet.ActiveConnection = $this.dataConnection
    $query = @"
      select memname, memtype, crdate, modate, nobs, nvar, compress,
             memlabel, typemem, filesize, delobs
      from sashelp.vtable
      where libname='$libname' and memname='$memname';
"@
    $objRecordSet.Open(
      $query,
      [System.Reflection.Missing]::Value, # Use the active connection
      2, # adOpenDynamic
      1, # adLockReadOnly
      1  # adCmdText
    )

    $result = New-Object psobject
    if (-not $objRecordSet.EOF) {
      $result | Add-Member -MemberType NoteProperty -Name "name" -Value $objRecordSet.Fields.Item(0).Value
      $result | Add-Member -MemberType NoteProperty -Name "type" -Value $objRecordSet.Fields.Item(1).Value
      $result | Add-Member -MemberType NoteProperty -Name "creationTimeStamp" -Value $objRecordSet.Fields.Item(2).Value
      $result | Add-Member -MemberType NoteProperty -Name "modifiedTimeStamp" -Value $objRecordSet.Fields.Item(3).Value
      $result | Add-Member -MemberType NoteProperty -Name "rowCount" -Value $objRecordSet.Fields.Item(4).Value
      $result | Add-Member -MemberType NoteProperty -Name "columnCount" -Value $objRecordSet.Fields.Item(5).Value
      $result | Add-Member -MemberType NoteProperty -Name "compressionRoutine" -Value $objRecordSet.Fields.Item(6).Value
      $result | Add-Member -MemberType NoteProperty -Name "label" -Value $objRecordSet.Fields.Item(7).Value
      $result | Add-Member -MemberType NoteProperty -Name "extendedType" -Value $objRecordSet.Fields.Item(8).Value
      $result | Add-Member -MemberType NoteProperty -Name "fileSize" -Value $objRecordSet.Fields.Item(9).Value
      $result | Add-Member -MemberType NoteProperty -Name "deletedObs" -Value $objRecordSet.Fields.Item(10).Value
      $result | Add-Member -MemberType NoteProperty -Name "libref" -Value $libname
    }
    $objRecordSet.Close()

    Write-Host $(ConvertTo-Json -Depth 10 -InputObject $result -Compress)
  }

  [void]GetTables([string]$libname) {
    $objRecordSet = New-Object -comobject ADODB.Recordset
    $objRecordSet.ActiveConnection = $this.dataConnection
    $query = @"
      select memname
      from sashelp.vtable
      where libname='$libname'
      order by memname asc;
"@
    $objRecordSet.Open(
      $query,
      [System.Reflection.Missing]::Value, # Use the active connection
      2, # adOpenDynamic
      1, # adLockReadOnly
      1  # adCmdText
    )

    $records = @()
    while (-not $objRecordSet.EOF) {
      $records += $objRecordSet.Fields.Item(0).Value
      $objRecordSet.MoveNext()
    }
    $objRecordSet.Close()

    $result = New-Object psobject
    $result | Add-Member -MemberType NoteProperty -Name "tables" -Value $records
    $result | Add-Member -MemberType NoteProperty -Name "count" -Value $records.Count

    Write-Host $(ConvertTo-Json -Depth 10 -InputObject $result -Compress)
  }
}
