# R Language Support

The SAS extension provides R language support for code within `PROC RLANG` blocks.

## Features

- **Function Documentation**: Hover over R functions to see help documentation from R's help system
- **Variable Inspection**: Hover over variables to see their definitions from source code
- **Live R Integration**: Uses your installed R runtime for accurate, up-to-date information

## Setup

### Install R

Download and install R from [https://www.r-project.org/](https://www.r-project.org/)

Verify installation:

```bash
R --version
```

### Configure R Path (Optional)

By default, the extension looks for `R` in your system PATH. To use a different R installation:

1. Open VS Code Settings (`Cmd+,` on macOS, `Ctrl+,` on Windows/Linux)
2. Search for "SAS R Runtime Path"
3. Set `SAS.r.runtimePath` to your R executable (e.g., `/usr/local/bin/R`)

The extension will detect R automatically on startup.

## Usage

### Example

```sas
proc rlang;
submit;
  # Hover over 'mean' to see R help documentation
  x <- c(1, 2, 3, 4, 5)
  result <- mean(x)

  # Hover over 'x' to see: x <- c(1, 2, 3, 4, 5)
  print(x)

  # Works with data frames too
  df <- data.frame(a = 1:3, b = letters[1:3])
endsubmit;
run;
```

## Troubleshooting

**No hover information appearing**

- Verify R is installed: `R --version`
- Check `SAS.r.runtimePath` setting is correct (or empty to use PATH)
- Ensure you're hovering within a `PROC RLANG` block
- Check VS Code Output panel (View → Output → "SAS Log") for errors

**R runtime not found warning**

- Install R from [https://www.r-project.org/](https://www.r-project.org/)
- Ensure R is in your system PATH, or set `SAS.r.runtimePath`
- Reload VS Code: `Developer: Reload Window`

```

```
