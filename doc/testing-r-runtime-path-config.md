# Testing R Language Support

## Quick Test

1. Ensure R is installed: `R --version`
2. Create a SAS file with R code:
   ```sas
   proc rlang;
   submit;
   x <- c(1, 2, 3)
   mean(x)
   endsubmit;
   run;
   ```
3. Hover over `mean` → Should see R help documentation
4. Hover over `x` → Should see `x <- c(1, 2, 3)`

## Test Scenarios

### Default Configuration (R in PATH)

- Leave `SAS.r.runtimePath` empty
- Verify R is accessible: `which R` (Unix) or `where R` (Windows)
- Hover over R functions should work automatically

### Custom R Path

- Set `SAS.r.runtimePath` to `/usr/local/bin/R` (or your R location)
- Reload VS Code
- Hover should use specified R installation

### No R Installation

- Remove R from PATH or set invalid `SAS.r.runtimePath`
- Check Output panel (View → Output → "SAS Log") for warning
- Hover should return no information (graceful degradation)

### Dynamic Configuration

- Change `SAS.r.runtimePath` while VS Code is open
- No reload needed - changes apply immediately
- Hover over R symbols to verify new path is used

## Test Examples

**Basic Functions:**

```sas
proc rlang;
submit;
  result <- mean(c(1, 2, 3, 4, 5))
  print(result)

  # Test with variables
  x <- 1:10
  summary(x)
endsubmit;
run;
```

**Data Frames:**

```sas
proc rlang;
submit;
  df <- data.frame(
    name = c("Alice", "Bob"),
    age = c(25, 30)
  )
  str(df)
endsubmit;
run;
```

## Configuration

Set `SAS.r.runtimePath` in VS Code settings:

- User Settings: `Preferences > Settings > Extensions > SAS`
- Workspace Settings: `.vscode/settings.json`:
  ```json
  {
    "SAS.r.runtimePath": "/usr/local/bin/R"
  }
  ```

## Logs

Check Output panel (View → Output → "SAS Log") for messages:

- `R runtime detected at '/usr/local/bin/R'` - Success
- `R runtime not found` - R not accessible
