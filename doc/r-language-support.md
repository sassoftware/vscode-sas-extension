# R Language Support

The SAS extension provides R language support for code within `PROC RLANG` blocks.

## Features

- **Hover Information**: Hover over R symbols to see their structure using `str()` (similar to the R extension)
- **Live R Evaluation**: Structure is obtained by evaluating symbols in your R environment
- **Object Inspection**: Works with functions, data frames, vectors, lists, and any R object

## Setup

### Requirements

R language support requires R to be installed and accessible:

1. **Install R**: Download and install R from [https://www.r-project.org/](https://www.r-project.org/)

2. **Configure R Path**: Set the R executable path in VS Code settings
   - Open Settings: `Code > Settings > Settings` (or `Cmd+,` on macOS)
   - Search for "SAS R Runtime Path"
   - Set `SAS.r.runtimePath` to your R executable path (e.g., `/usr/local/bin/R`)
   - If left empty, the extension will look for `R` in your system PATH

3. **Verify R is accessible**: Test in your terminal
   ```bash
   R --version
   ```

4. **Optional - Install jsonlite**: For better JSON handling (will work without it)
   ```r
   install.packages("jsonlite")
   ```

The extension will automatically detect R and use the live help system.

## How It Works

1. When you hover over an R symbol in a `PROC RLANG` block
2. The extension extracts the symbol name
3. Evaluates the symbol in R and captures its structure using `str()`
4. Formats the output as a code block
5. Displays the hover information

**Note**: This shows the structure of objects similar to the official R extension for VS Code. If R is not available, hover support will be disabled.

## Configuration

By default, the extension looks for `R` in your system PATH. You can configure a custom R path if needed (future enhancement).

## Example

```sas
proc rlang;
submit;
  # Hover over 'mean' to see function signature
  x <- c(1, 2, 3, 4, 5)
  result <- mean(x)
  
  # Hover over 'x' to see vector structure
  # Shows: num [1:5] 1 2 3 4 5
  
  # Create a data frame
  df <- data.frame(a = 1:3, b = letters[1:3])
  # Hover over 'df' to see structure:
  # 'data.frame': 3 obs. of 2 variables:
  #  $ a: int 1 2 3
  #  $ b: chr "a" "b" "c"
**Issue**: Not seeing structure information when hovering
- Check if R is installed: `R --version`
- Verify `SAS.r.runtimePath` setting is correct (or empty to use PATH)
- Check VS Code Output panel (select "SAS Language Server") for error messages
- Ensure you're hovering within a `PROC RLANG` block
- Ensure the symbol is defined/available in the R environment
- Try reloading VS Code window: `Developer: Reload Window`
**Issue**: Not seeing documentation when hovering
- Check if R is installed: `R --version`
- Verify `SAS.r.runtimePath` setting is correct (or empty to use PATH)
- Check VS Code Output panel (select "R Language Server") for error messages
- Ensure you're hovering within a `PROC RLANG` block
- Try reloading VS Code window: `Developer: Reload Window`

**Issue**: R runtime not found warning
- Install R from [https://www.r-project.org/](https://www.r-project.org/)
- Set `SAS.r.runtimePath` to the full path of your R executable
- Or add R to your system PATH
- Reload VS Code after making changes
