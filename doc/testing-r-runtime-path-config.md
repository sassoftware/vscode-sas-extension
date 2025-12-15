# Testing R Runtime Path Configuration

## Overview

The extension now supports a configurable R runtime path via the `SAS.r.runtimePath` setting. This document describes how to test the feature.

## Implementation Details

### Configuration Flow

1. **Client** (`client/src/node/extension.ts`):
   - Reads `SAS.r.runtimePath` from workspace configuration
   - Passes value to server via `initializationOptions.rRuntimePath`

2. **Server** (`server/src/server.ts`):
   - Receives R path in `onInitialize` from `params.initializationOptions.rRuntimePath`
   - Calls `await _rLanguageProvider.setRPath(rRuntimePath)` asynchronously
   - Handles configuration changes in `onDidChangeConfiguration`

3. **R Language Provider** (`server/src/r/node/RLanguageProviderNode.ts`):
   - `setRPath(rPath)` method creates new `RHelpService` with specified path
   - Checks R availability and logs status
   - Falls back to static documentation if R is unavailable

### Fallback Behavior

- If `SAS.r.runtimePath` is empty (default), uses `"R"` (expects R in PATH)
- If specified R path is invalid, logs warning and falls back to static docs
- Static documentation always available as last resort

## Testing Scenarios

### Test 1: Default Behavior (R in PATH)

1. Ensure `SAS.r.runtimePath` is empty (default)
2. Ensure R is in your system PATH: `which R`
3. Create a test SAS file with PROC RLANG block
4. Hover over R function like `mean` or `sum`
5. **Expected**: See live R help documentation

### Test 2: Custom R Path

1. Set `SAS.r.runtimePath` to full R executable path: `/usr/local/bin/R`
2. Reload VS Code window
3. Create a test SAS file with PROC RLANG block
4. Hover over R function
5. **Expected**: See live R help documentation using specified path

### Test 3: Invalid R Path (Fallback)

1. Set `SAS.r.runtimePath` to invalid path: `/invalid/path/to/R`
2. Reload VS Code window
3. Check Output panel for "R Language Server" logs
4. Create a test SAS file with PROC RLANG block
5. Hover over R function
6. **Expected**:
   - Log warning about R unavailability
   - See static documentation (not live R help)

### Test 4: Dynamic Configuration Change

1. Start with valid R path
2. Hover over R function to confirm live help works
3. Change `SAS.r.runtimePath` to different path (or empty)
4. Wait a moment (no reload needed)
5. Hover over R function again
6. **Expected**: Documentation updates to use new R path

### Test 5: tidyverse Function

1. Ensure tidyverse is installed: `R -e "library(dplyr)"`
2. Set valid R path in `SAS.r.runtimePath`
3. Create SAS file with PROC RLANG block using `mutate` or `filter`
4. Hover over tidyverse function
5. **Expected**: See tidyverse function documentation (not possible with static docs)

## Test File Example

Create `test-r-hover.sas`:

```sas
proc rlang;
submit;
# Test basic R functions
result <- mean(c(1, 2, 3, 4, 5))
print(result)

# Test stats functions
summary(mtcars$mpg)
sd(mtcars$mpg)

# Test tidyverse (if installed)
library(dplyr)
mtcars %>% filter(mpg > 20) %>% select(mpg, cyl)
endsubmit;
quit;
```

## Checking Logs

1. Open VS Code Output panel: `View > Output`
2. Select "R Language Server" from dropdown
3. Look for messages like:
   - `R runtime available at: /usr/local/bin/R`
   - `R runtime not available, using static documentation`
   - `R path updated to: /new/path/to/R`

## Configuration Setting Location

- **User Settings**: `Code > Settings > Extensions > SAS > R: Runtime Path`
- **Workspace Settings**: `.vscode/settings.json`:
  ```json
  {
    "SAS.r.runtimePath": "/usr/local/bin/R"
  }
  ```
- **Command Palette**: `Preferences: Open Settings (UI)` → search "SAS R runtime"

## Troubleshooting

### No hover information appearing

1. Check that file language is set to "sas"
2. Ensure cursor is inside PROC RLANG block
3. Check Output panel for errors

### Live R help not working

1. Verify R is accessible: `R --version` in terminal
2. Check `SAS.r.runtimePath` setting
3. Look for error messages in Output panel
4. Should fall back to static documentation

### Configuration changes not taking effect

1. Configuration changes should apply dynamically
2. If not, try reloading VS Code window: `Developer: Reload Window`
3. Check Output panel for "R path updated" message
