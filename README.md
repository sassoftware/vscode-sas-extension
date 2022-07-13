# SAS Extension for Visual Studio Code

Welcome to the SAS Extension for Visual Studio Code! This extension provides support for the [SAS language](https://go.documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/lrcon/titlepage.htm), including the following features:

- [SAS Extension for Visual Studio Code](#sas-extension-for-visual-studio-code)
  - [Installation](#installation)
  - [Features](#features)
    - [SAS Syntax Highlighting](#sas-syntax-highlighting)
    - [Color Themes](#color-themes)
    - [Code Completion](#code-completion)
    - [Pop-up Syntax Help](#pop-up-syntax-help)
    - [Snippets](#snippets)
    - [Code Folding and Code Outline](#code-folding-and-code-outline)
    - [Configuring the SAS Extension](#configuring-the-sas-extension)
    - [Running SAS Code](#running-sas-code)
  - [Support](#support)
    - [SAS Communities](#sas-communities)
    - [SAS Programming Documentation](#sas-programming-documentation)
    - [FAQs](#faqs)
    - [GitHub Issues](#github-issues)
  - [Contributing to the SAS Extension](#contributing-to-the-sas-extension)
  - [License](#license)

## Installation

To install the SAS extension, open the Extensions view by clicking the Extensions icon in the Activity Bar on the left side of the Visual Studio Code window. Search for the 'Official' SAS extension, and click the Install button. Once the installation is complete, the Install button changes to the Manage button.

## Features

### SAS Syntax Highlighting

The SAS extension highlights these syntax elements in your program, just as they would appear in a SAS editor:

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

You can choose among three SAS-related color themes that control the color of the application and syntax elements. The SAS Light, SAS Dark and SAS High Contrast options mirror the themes available in SAS Studio.

To specify the color theme:

- Select `File > Preferences > Color Theme` and select the theme, by name. The image below demonstrates the process changing from SAS Light to SAS Dark.

<img src="doc/images/vsCodeChangeTheme2.gif"/>

### Code Completion

The SAS extension includes automatic code completion and pop-up syntax help for SAS keywords. The autocomplete, or code completion, feature in the code editor can predict the next word that you want to enter in your SAS program. See code completion in action below.

<img src="doc/images/vsCodeTypeAhead.gif"/>

To use the autocomplete feature:

- Start typing a valid SAS keyboard. Scroll through the pop-up list of suggested keywords by using your mouse or the up and down arrow keys.

### Pop-up Syntax Help

The syntax help gets you started with a hint about the syntax or a brief description of the keyword. You can get additional help by clicking the links in the syntax help window.

To view the syntax help:

- Move the mouse pointer over a valid SAS keyword in the code.

In the following example, the help panel displays syntax help for the DATA= option in the PROC PRINT statement.

<img src="doc/images/vsCodeSyntaxAssist2.gif"/>

_Tip_: Click the links in the syntax help window to navigate to the SAS online help.

### Snippets

Snippets are lines of commonly used code or text that you can insert into your program. The SAS extension includes snippets for SAS functions and procedures to facilitate writing your SAS programs.

To access the list of snippets for a function or procedure:

- Type the name of a function or procedure in your SAS program. This example shows a snippet for the PROC DS2.

<img src="doc/images/vsCodeSnippets.gif"/>

### Code Folding and Code Outline

Regions of code are identified in your SAS program as blocks of code that can be collapsed and expanded. You can also view an outline of your program that identifies DATA steps, procedures, macro sections, and user-defined regions of code.

<img src="doc/images/vsCodeFoldAndOutline.gif"/>

_Tip_: You can define a custom region by adding `/*region*/` and `/*endregion*/` tags to the start and end of the block of code.

<img src="doc/images/vsCodeRegionFunction.gif"/>

### Configuring the SAS Extension

Before running SAS code, you must configure the SAS extension to access a SAS Viya server. You must license SAS Viya to run SAS code.

To configure the SAS extension, open the Settings editor for the SAS extension by selecting `File > Preferences > Settings`. Expand the Extensions folder and select SAS.

**Session - General**
General parameter settings for the extension

| Parameter       | Description                      | Sample Value                      |
| --------------- | -------------------------------- | --------------------------------- |
| Host            | Full URL of SAS Viya server      | https://sasserver.sas.com         |
| Compute Context | Compute context name             | SAS Job Execution compute context |
| Output HTML     | Generates results in HTML format | Default is 'On'                   |

**Session - Password authentication**
To authenticate with password, specify client ID, client secret, and user name.

| Parameter     | Description                  | Sample Value |
| ------------- | ---------------------------- | ------------ |
| Client ID     | Registered client            | myapp.client |
| Client Secret | Provide secret for client ID | myapp.secret |
| User          | SAS Viya username            | john_doe     |

**Session - Token authentication**
To authenticate with an access token, specify the full path for a token file.

| Parameter  | Description                                   | Sample Value                      |
| ---------- | --------------------------------------------- | --------------------------------- |
| Token File | SAS access token value stored in a local file | C:\Users\johndoe\SAS\access_token |

For more information about the authentication process, please see the blog post [Authentication to SAS Viya: a couple of approaches](https://blogs.sas.com/content/sgf/2021/09/24/authentication-to-sas-viya/).

### Running SAS Code

After configuring the SAS extension for your SAS environment, run your SAS program and view the log and results.

To run a SAS program:

1. Click `Run` (running man icon) in the upper right corner of your SAS program window.
   1.a. If prompted, enter your password (for password authentication).
2. The results are displayed in the application.
3. The SAS output log and error information are displayed in the applicaiton.

<img src="doc/images/sasProgramOutput2.png"/>

**Notes**:

- A new session must be created the first time you run SAS code. Connection time will vary depending on the server connection.
- Currently, only HTML output is supported. By default, the ODS HTML5 statement is added to the submitted code. Clear the Get ODS HTML5 Output option in the Settings editor for the SAS extension to disable this output.
- When you click `Run`, the code in the active tab in the editor is submitted. Make sure that the correct tab is active when you run your program.
- Selecting individual code blocks is not currently supported.
- To reset your connection to the SAS Viya server, run the `Close current session` command in VS code or click the `Close current session` button next to the `Run` button.

## Support

### SAS Communities

Ask, Find, and Share on the VS Code SAS Extension on the [SAS Programmers Community site](https://communities.sas.com/t5/SAS-Programming/bd-p/programming).

### SAS Programming Documentation

[SAS Programming documentation](https://go.documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/lrcon/titlepage.htm)

### FAQs

Please check the [FAQ](https://github.com/sassoftware/vscode-sas-extension/wiki/FAQ) page for some common questions.

### GitHub Issues

See the [SUPPORT.md](SUPPORT.md) file for information on how to open an issue against this repository.

## Contributing to the SAS Extension

We welcome your contributions! Please read [CONTRIBUTING.md](/CONTRIBUTING.md) for details on how to submit contributions to this project.

## License

This project is subject to the SAS Code Extension Terms, a copy of which is included as [Code_Extension_Agreement.pdf](/Code_Extension_Agreement.pdf)
