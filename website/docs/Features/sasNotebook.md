---
sidebar_position: 8
---

# SAS Notebook

SAS Notebook is an interactive notebook file that includes markdown code, executable code snippets, and corresponding rich output cells.

- To create a SAS notebook, select `File > New File > SAS Notebook`.
- To change a code language, click the `Select Cell Language Mode` button in the lower right corner of a code cell.
- To toggle log or ODS output display, click the **More Actions** (`...`) button in the upper left corner of the output and select `Change Presentation`.
- You can use the `File` menu to save your SAS Notebook to a `.sasnb` file, share the notebook with others, and open the notebook in another VS Code window.

![SAS Notebook](/images/sasNotebook.png)

:::note

Starting with Visual Studio Code version 1.93, [the language for SQL files has been renamed](https://code.visualstudio.com/updates/v1_93#_renamed-sql-to-ms-sql) from 'SQL' to 'MS SQL'. As a result, the SQL cell in SAS Notebook is now labeled 'MS SQL'. The SAS Extension for Visual Studio Code does not control the label of the SQL cell in SAS Notebook. The functionality of the SQL cell has not changed, however. Valid PROC SQL code continues to work in the MS SQL cell.

:::

## Language Support for Embedded Code

SAS Notebook supports multiple languages including Python, R, SQL, and Lua. When working with these languages in SAS notebooks, enhanced language features such as code completion, hover information, and signature help are available.

### Python Language Features

Python code cells benefit from integrated IntelliSense powered by Pyright, which is included with the extension. No additional setup is required for Python language features.

### R Language Features

R code cells include basic IntelliSense features (code completion and hover documentation) for common R functions:

- **In VS Code Desktop**: Basic code completion and hover information for common R functions is provided automatically - no installation required
- **In Browser (VS Code for Web)**: Enhanced R language features are automatically available via WebR - no installation required! WebR provides basic code completion and hover information for common R functions.

Note: R code execution via PROC RLANG requires a SAS connection, but the language features work independently.

## Export

To export your SAS Notebook to other formats, click the **More Actions** (`...`) button on the notebook toolbar at top, and select `Export`. The following formats are supported.

### SAS

PYTHON, R, and SQL code cells will be wrapped with PROC PYTHON/RLANG/SQL respectively to be executed on SAS. Markdown cells will be converted to block comments.

### HTML

The exported HTML will be in Light or Dark theme depending on your VS Code theme kind.

By default it doesn't include SAS log into the exported HTML file. To include log, check the `SAS.notebook.export.includeLog` setting.
