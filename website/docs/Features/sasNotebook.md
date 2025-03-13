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

## Export

To export your SAS Notebook to other formats, click the **More Actions** (`...`) button on the notebook toolbar at top, and select `Export`. The following formats are supported.

### SAS

PYTHON and SQL code cells will be wrapped with PROC PYTHON/SQL respectively to be executed on SAS. Markdown cells will be converted to block comments.

### HTML

The exported HTML will be in Light or Dark theme depending on your VS Code theme kind.

By default it doesn't include SAS log into the exported HTML file. To include log, check the `SAS.notebook.export.includeLog` setting.
