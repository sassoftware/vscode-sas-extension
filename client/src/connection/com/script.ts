export const scriptContent = `
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
  [void]Setup([string]$profileHost) {
    try {
        # create the Integration Technologies objects
        $objFactory = New-Object -ComObject SASObjectManager.ObjectFactoryMulti2
        $objServerDef = New-Object -ComObject SASObjectManager.ServerDef
        $objServerDef.MachineDNSName = $profileHost # SAS Workspace node
        $objServerDef.Port = 0  # workspace server port
        $objServerDef.Protocol = 0     # 0 = COM protocol
        
        # Class Identifier for SAS Workspace
        $objServerDef.ClassIdentifier = "440196d4-90f0-11d0-9f41-00a024bb830c"

        # create and connect to the SAS session 
        $this.objSAS = $objFactory.CreateObjectByServer(
            "SASApp", # server name
            $true, 
            $objServerDef, # built server definition
            "", # user ID
            ""    # password
        )

    } catch {
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

    [ref] $errorIndices = [int[]]::new($names.Length)
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
}

`;
