function GetFilteredView {
  param(
    [string]$Library,
    [string]$Table,
    [string]$SortCriteria = "",
    [string]$JSONQueryData = ""
  )

  $epoch = [datetime]::FromFileTimeUtc(0)
  $currentUtcTime = (Get-Date).ToUniversalTime()
  $ts = [int64]($currentUtcTime - $epoch).TotalSeconds
  $tableName = "WORK.temp_$ts"

  $query = "CREATE VIEW $tableName AS SELECT * FROM $library.$table"

  if ($JSONQueryData -ne "") {
    $queryParams = $JSONQueryData | ConvertFrom-Json
    if ($queryParams.filterValue) {
      $query = "$query WHERE $($queryParams.filterValue)"
    }
  }

  if ($SortCriteria -ne "") {
    $query = "$query ORDER BY $sortCriteria"
  }

  return @{
    Query = $query
    Name  = $tableName
  }
}

Export-ModuleMember -Function GetFilteredView