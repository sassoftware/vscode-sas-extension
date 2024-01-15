<#
  Use this script to test itc connections. This roughly mimics the code in `client/src/connection/itc`
  and aids in debugging issues with ITC connections. To test, replace any values wrapped in brackets
  (i.e. `<username>`) and run with Windows Powershell ISE.
#>
class SASRunner{
  [System.__ComObject] $objSAS

  [void]ResolveSystemVars(){
  $code =
@'
   %let workDir = %sysfunc(pathname(work));
   %put &=workDir;
   %let rc = %sysfunc(dlgcdir("&workDir"));
   run;
'@
    $this.Run($code)
    $varLogs = $this.FlushLog(4096)
    Write-Host $varLogs
  }
  [void]Setup([string]$profileHost, [string]$username, [string]$password, [int]$port, [int]$protocol, [string]$serverName, [string]$displayLang) {
    try {
        # Set Encoding for input and output
        $null = cmd /c ''
        $Global:OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

        # create the Integration Technologies objects
        $objFactory = New-Object -ComObject SASObjectManager.ObjectFactoryMulti2
        $objServerDef = New-Object -ComObject SASObjectManager.ServerDef
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

        Write-Host "Session created"
    } catch {
      Write-Error $_
      throw "Setup error"
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
        Write-Error $Error[0].Exception.Message
    }
  }

  [void]Run([string]$code) {
    try{
        $this.objSAS.LanguageService.Reset()
        $this.objSAS.LanguageService.Async = $true
        $this.objSAS.LanguageService.Submit($code)
    }catch{
      Write-Error $_.ScriptStackTrace
      throw "Run error"
    }
  }

  [void]Close(){
  try{
        $this.objSAS.Close()
    }catch{
      throw "Close error"
    }
  }

  [void]Cancel(){
  try{
        $this.objSAS.LanguageService.Cancel()
        Write-Host "Run Cancelled"
      }catch{
        throw "Cancel error"
      }
    }

  [String]FlushLog([int]$chunkSize) {
      try{
        return $this.objSAS.LanguageService.FlushLog($chunkSize)
      } catch{
        throw "FlushLog error"
      }
      return ""
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
    $objFile = $this.objSAS.FileService.AssignFileref("outfile", "DISK", $filePath, "", [ref] $fileRef)
    $objStream = $objFile.OpenBinaryStream(1);
    [Byte[]] $bytes = 0x0

    $endOfFile = $false
    $byteCount = 0
    $outStream = [System.IO.StreamWriter] $outputFile
    do
    {
      $objStream.Read(1024, [ref] $bytes)
      $outStream.Write([System.Text.Encoding]::UTF8.GetString($bytes))
      $endOfFile = $bytes.Length -lt 1024
      $byteCount = $byteCount + $bytes.Length
    } while (-not $endOfFile)

    $objStream.Close()
    $outStream.Close()
    $this.objSAS.FileService.DeassignFileref($objFile.FilerefName)

    Write-Host "Results Fetched"
  }
}

$runner = New-Object -TypeName SASRunner
$profileHost = "<server host>"
$port = 8591 # Specify IOM port
$protocol = 2 # IOMBridge
$username = "<username>"
$password = "<password>"
$serverName = "ITC IOM Bridge"
$displayLang = "<locale>" # EN_US, ZH_CN, etc
$runner.Setup($profileHost,$username,$password,$port,$protocol,$serverName,$displayLang)
$runner.ResolveSystemVars()

# Uncomment the following line to set any options
# $runner.SetOptions("VALIDVARNAME=ANY")

# Adjust the value of $code as needed
$code = "proc options group=languagecontrol;"
$runner.Run($code)

do {
  $chunkSize = 32768
  $log = $runner.FlushLog($chunkSize)
  Write-Host $log
} while ($log.Length -gt 0)
