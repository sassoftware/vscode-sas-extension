---
sidebar_position: 8
---

# R Language Support

The SAS extension provides comprehensive R language support for code within `PROC RLANG` blocks.

## Features

### Hover Documentation

- **Function Documentation**: Hover over R functions to see help documentation from R's help system
- **Variable Inspection**: Hover over variables to see their definitions from source code

### Auto-completion

- **Function Suggestions**: Type to see available R functions from loaded packages
- **Variable Suggestions**: See local variables defined in your R code
- **Context-Aware**: Prefix-based matching with smart filtering

### Signature Help

- **Parameter Information**: See function parameters and defaults as you type
- **Active Parameter**: Highlights the current parameter you're editing
- **Documentation**: Brief function description inline

### Live R Integration

Uses your installed R runtime for accurate, up-to-date information

## Requirements

- **Desktop VS Code only** - R language features require a local R installation and are not available in browser environments (VS Code for Web, vscode.dev, github.dev)
- **R runtime** - Version 3.0 or higher recommended

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

### Hover Documentation

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

### Auto-completion

Type to see suggestions:

```sas
proc rlang;
submit;
  x <- c(1, 2, 3)

  # Type "me" and see: mean, median, merge, message, etc.
  result <- me

  # Local variables appear in completions too
  myVariable <- 42
  my  # Shows: myVariable
endsubmit;
run;
```

### Signature Help

See parameters as you type:

```sas
proc rlang;
submit;
  # Type "mean(" to see: mean(x, trim = 0, na.rm = FALSE, ...)
  result <- mean(

  # Active parameter updates as you type commas
  result <- mean(x,
endsubmit;
run;
```

## Troubleshooting

### No hover/completion/signature help appearing

- Verify R is installed: `R --version`
- Check `SAS.r.runtimePath` setting is correct (or empty to use PATH)
- Ensure you're working within a `PROC RLANG` block
- Check VS Code Output panel (View → Output → "SAS") for errors
- Reload VS Code: `Developer: Reload Window`

### R runtime not found warning

- Install R from [https://www.r-project.org/](https://www.r-project.org/)
- Ensure R is in your system PATH, or set `SAS.r.runtimePath`
- Reload VS Code: `Developer: Reload Window`

### Completions not showing

- Type at least 1 character to trigger completions
- Wait ~300ms for results to load
- Check that R runtime is available (see Output panel)

### Signature help not showing

- Trigger character is `(` - type it after a function name
- Ensure cursor is within the function call parentheses
- Try typing `,` to see the next parameter highlighted
