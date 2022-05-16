# SAS Extension for Visual Studio Code

Welcome to the SAS Extension for Visual Studio Code! This extension provides support for the [SAS language](https://go.documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/lrcon/titlepage.htm), including the following features:

- [SAS syntax highlighting](#sas-syntax-highlighting)
- [Color themes](#color-themes)
- [Code completion](#code-completion)
- [Pop-up syntax help](#pop-up-syntax-help)
- [Snippets](#snippets)
- [Code folding and code outline](#code-folding-and-code-outline)
- [Configuring the SAS Extension](#configuring-the-sas-extension)
- [The ability to run SAS code](#running-sas-code)

## Installation

To install the SAS extension, open the Extensions view by clicking the Extensions icon in the Activity Bar on the left side of the Visual Studio Code window. Search for the SAS extension, and click the Install button. Once the installation is complete, the Install button changes to the Manage button.

## Features

### SAS Syntax Highlighting

The SAS extension highlights these syntax elements in your program:

- Global statements
- SAS procedures
- SAS procedure statements
- Data step definition
- Data step statements
- SAS data sets
- Macro definition
- Macro statements
- Functions
- CALL routines
- Formats and informats
- Macro variables
- SAS colors
- Style elements and style attributes
- Comment
- Various constants
- Options, enumerated option values, sub-options and sub-option values for various procedure definitions and statements

### Color Themes

You can choose from among different color themes that control the color of the application and syntax elements.

To specify the color theme:

- Select `File > Preferences > Color Theme` and select the theme that you want to use. The SAS Extension includes three color themes: SAS Light, SAS Dark, and SAS High Contrast.

- SAS Light

<img src="doc/images/Illuminate.PNG"/>

- SAS Dark

<img src="doc/images/Ignite.PNG"/>

- SAS High Contrast

<img src="doc/images/HighContrast.PNG"/>

### Code Completion

The SAS Extension includes automatic code completion and pop-up syntax help for SAS keywords. The autocomplete, or code completion, feature in the code editor can predict the next word that you want to enter in your SAS program before you enter it completely.

To use the autocomplete feature:

- Start typing a valid SAS keyboard. Scroll through the pop-up list of suggested keywords by using your mouse or the up and down arrow keys.

### Pop-up Syntax Help

The syntax help can get you started with a hint about the syntax or a brief description of the keyword. You can get additional help by clicking the links in the syntax help window.

To view the syntax help:

- Move the mouse pointer over a valid SAS keyword in the code.

In the following example, the help panel displays syntax help for the DATA= option in the PROC PRINT statement.

_Tip_: Click the links in the syntax help window to navigate to the SAS online help.
<img src="doc/images/CodeCompletion.PNG"/>

### Snippets

Snippets are lines of commonly used code or text that you can insert into your program. The SAS extension includes a few snippets for SAS functions and procedures to help you write SAS programs more quickly.

To access the list of snippets for a function or procedure:

- Type the name of a function or procedure in your SAS program. This example shows a snippet for the PROC DS2.
  <img src="doc/images/Snippets.PNG"/>

### Code Folding and Code Outline

Regions of code are identified in your SAS program as blocks of code that can be collapsed and expanded. You can also view an outline of your program that identifies DATA steps, procedures, macro sections, and user-defined regions of code.

_Tip_: You can define a custom region by adding `/*region*/` and `/*endregion*/` tags to the start and end of the block of code.
<img src="doc/images/Folding.PNG"/>

### Configuring the SAS Extension

Before you can run SAS code, you must configure the SAS Extension to access a SAS Viya server. You must license SAS Viya to run SAS code.

To configure the SAS extension:

1. Open the Settings editor for the SAS Extension by selecting `File > Preferences > Settings`. Expand the Extensions folder and select SAS. Specify your client ID, client secret, SAS Viya server URL and username. For information about your client ID and client secret, contact your SAS administrator. (SAS administrator can refers to this [documentation](https://go.documentation.sas.com/doc/en/sasadmincdc/v_022/calauthmdl/n1iyx40th7exrqn1ej8t12gfhm88.htm#n0brttsp1nuzzkn1njvr535txk86) for how to generate client IDs.) _Tip_: You can also specify the full path for a token file to authenticate with your SAS Viya server.

2. If you do not want to generate results in HTML format, clear the Get ODS HTML5 Output option. This option is selected by default.

### Running SAS Code

After you configure the SAS Extension, you can run your SAS program and view the log and results.

To run a SAS program:

1. Click `Run` in the upper right corner of your SAS program window.
2. When you are prompted, enter your password. Your SAS log and any results are displayed in the application.

<img src="doc/images/RunResult.PNG"/>

**Note**:

- A new session must be created the first time you run SAS code, which can take 10 - 60 seconds, depending on the server connection.
- Currently, only HTML output is supported. By default, the ODS HTML5 statement is added to the code that you are submitting. You can clear the Get ODS HTML5 Output option in the Settings editor for the SAS Extension to disable this output.
- When you click `Run`, the code in the active tab in the editor is submitted. Make sure that the correct tab is active when you run your program.
- To reset your connection to the SAS Viya server, run the `Close current session` command in VS code or click the `Close current session` button next to the Run button.

## Contributing to the SAS Extension

We welcome your contributions! Please read [CONTRIBUTING.md](/CONTRIBUTING.md) for details on how to submit contributions to this project.

## License

This project is subject to the SAS Code Extension Terms, a copy of which is included as [Code_Extension_Agreement.pdf](/Code_Extension_Agreement.pdf)
