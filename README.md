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
    - [Profiles](#profiles)
      - [Profile Anatomy (Viya)](#profile-anatomy-viya)
      - [Profile Anatomy (SAS 9.4 Remote)](#profile-anatomy-sas-94-remote)
      - [Add New SAS Profile](#add-new-sas-profile)
      - [Delete SAS Profile](#delete-sas-profile)
      - [Switch Current SAS Profile](#switch-current-sas-profile)
      - [Update SAS Profile](#update-sas-profile)
    - [Running SAS Code](#running-sas-code)
    - [Accessing SAS Content](#accessing-sas-content)
    - [Accessing Libraries and Tables](#accessing-libraries-and-tables)
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

Before running SAS code, you must configure the SAS extension to access a SAS 9.4 or Viya server. You must license SAS 9.4 or Viya to run SAS code.

1. When first configuring, open up a file with the SAS language. "No Profile" can be located on the Status Bar located at the bottom left of your VSCode window

   ![No Active Profiles Found](doc/images/NoActiveProfilesStatusBar.png)

2. Either select the "No Profile" Status Bar Item or open the command palette (`F1`, or `Ctrl+Shift+P` on Windows or Linux, or `Shift+CMD+P` on OSX) and locate `SAS: Add New Connection Profile`
3. Please refer to the [Add SAS Connection Profile](#add-new-sas-profile) section below to add a profile
4. After a profile is created, the Status Bar Item will be changed from "No Profile" to the name of the new profile.

   ![Status Bar Profile](doc/images/StatusBarProfileItem.png)

5. If you do not want to generate results in HTML format, clear the `Enable/disable ODS HTML5 output` setting. This option is enabled by default.

### Profiles

Profiles are easy ways to switch between multiple SAS deployments. For Viya connections, multiple Viya profiles can be used to switch between compute contexts. There is no limit to the amount of profiles that can be stored.

Profiles will be stored into the VSCode settings.json file, and can be modified by hand, if needed.

The following commands are supported for profiles:

| Command             | Title                                  |
| ------------------- | -------------------------------------- |
| `SAS.addProfile`    | SAS: Add New Connection Profile        |
| `SAS.switchProfile` | SAS: Switch Current Connection profile |
| `SAS.updateProfile` | SAS: Update Connection profile         |
| `SAS.deleteProfile` | SAS: Delete Connection profile         |

#### Profile Anatomy (Viya)

| Name                | Description                           | Additional Notes                                                                                                                                      |
| ------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**            | Name of the profile                   | This will display on the status bar                                                                                                                   |
| **Endpoint**        | Viya endpoint                         | This will appear when hovering over the status bar                                                                                                    |
| **Compute Context** | Context for Compute Server            | Please see [SAS Documentation](https://go.documentation.sas.com/doc/en/sasadmincdc/v_014/evfun/p1dkdadd9rkbmdn1fpv562l2p5vy.htm) for more information |
| **Client ID**       | Registered Client ID for SAS Viya     | Please see your SAS administrator. `authorization_code` and `refresh_token` grant types are required.<br /> _Leave empty for Viya4 2022.11 and later_ |
| **Client Secret**   | Registered Client Secret for SAS Viya | Please see your SAS administrator.<br /> _Leave empty for Viya4 2022.11 and later_                                                                    |

#### Profile Anatomy (SAS 9.4 Remote)

| Name         | Description                          | Additional Notes                                                     |
| ------------ | ------------------------------------ | -------------------------------------------------------------------- |
| **Name**     | Name of the profile                  | This will display on the status bar                                  |
| **Host**     | SSH Server Host                      | This will appear when hovering over the status bar                   |
| **Username** | SSH Server Username                  | A username to use when establishing the SSH connection to the server |
| **Port**     | SSH Server Port                      | The ssh port of the SSH server. Default value is 22                  |
| **SAS Path** | Path to SAS Executable on the server | Must be a fully qualified path on the SSH server to a SAS executable |

#### Add New SAS Profile

Open the command palette (`F1`, or `Ctrl+Shift+P` on Windows or Linux, or `Shift+CMD+P` on OSX). After executing the `SAS.addProfile` command, select a connection type and complete the prompts to create a new profile. For SAS Viya Connections, depending on your SAS version, the values for the prompts differ slightly.

- For SAS Viya 2022.11 and later, you can leave Client ID and Client Secret prompts empty and simply press Enter. (The built-in Client ID `vscode` will be used.)
- For SAS Viya 2022.10 and before (including SAS Viya 3.5), you need to provide a Client ID and secret.

For more information about Client IDs and the authentication process, please see the blog post [Authentication to SAS Viya: a couple of approaches](https://blogs.sas.com/content/sgf/2021/09/24/authentication-to-sas-viya/). A SAS administrator can follow the Steps 1 and 2 in the post to register a new client.

#### Delete Connection Profile

After executing the `SAS.deleteProfile` command:

1. Select profile to delete from the list of profiles
2. A notification message will pop up on successful deletion

#### Switch Current Connection Profile

After executing the `SAS.switchProfile` command:

1. If no profiles can be found, the extension will ask to [create a new profile](#add-new-sas-profile)
2. Select profile to set active from the list of profiles
3. The StatusBar Item will update to display the name of the selected profile

#### Update Connection Profile

Update profile gives the ability to modify existing profiles, including updating from password to token flow and vice versa.

After executing the `SAS.updateProfile` command:

1. Select profile to update from the list of profiles
2. Complete the prompts to update profile

To update the name of a profile, please delete and recreate it.

### Running SAS Code

After configuring the SAS extension for your SAS environment, run your SAS program and view the log and results.

To run a SAS program:

1. Click the running man icon in the upper right corner of your SAS program window.
2. For a secure connection to SAS Viya we use an authorization code for authentication. Complete these steps to connect.

   1.1. VS Code may prompt you that the extension wants to sign in. Click 'Allow'.

   1.2. VS Code may prompt you about opening an external web site. Click 'Open'.

   1.3. This will take you to a SAS Logon prompt. Log in with your SAS credentials.

   1.4. SAS returns an authorization code. Copy this code.

   1.5. Paste the authorization code in VS Code where indicated at the top of the screen.

3. For a secure connection to SAS 9.4 remote, a public / private ssh key pair is required. The socket defined in the environment variable `SSH_AUTH_SOCK` is used to communicate with ssh-agent to authenticate the ssh session. The private key must be registered with ssh-agent.
4. VS Code connects to SAS and runs the code.
5. The results are displayed in the application.
6. The SAS output log and error information are displayed in the applicaiton.

**Note:** Your sign in status will persist in VS Code. You can view it and sign out from VS Code's `Accounts` menu.

<img src="doc/images/runCode.png"/>

To run a piece of SAS code:

- The `Run Selected or All SAS Code` command (`F3`) will automatically run selected code when there's a selection, and run all code when there's no selection.
- When there're multiple selections, The `Run Selected or All SAS Code` command will combine the code from the selections in the order in which they were selected, and then submits the combined code.
- The `Run All SAS Code` command (`F8`) will always run all code regardless of selection.

**Notes**:

- A new session must be created the first time you run SAS code. Connection time will vary depending on the server connection.
- Currently, only HTML output is supported. By default, the ODS HTML5 statement is added to the submitted code. Clear the `Enable/disable ODS HTML5 output` option in the Settings editor for the SAS extension to disable this output.
- When you click `Run`, the code in the active tab in the editor is submitted. Make sure that the correct tab is active when you run your program.
- To reset your connection to SAS, run the `Close Current Session` command in VS Code or click the `Close Current Session` button next to the `Run` button.

### Accessing SAS Content

After configuring the SAS extension for a SAS Viya environment, you will be able to access SAS Content.

To access SAS Content:

1. Click the SAS icon in VSCode's activity bar.
2. Click Sign In.
3. Your SAS Content should be displayed after sign in. From here, you are able to create, edit, delete, and run files stored on a SAS server.

**Notes**:

- SAS Content requires a profile with a connection to a Viya instance.

### Accessing Libraries and Tables

After configuring the SAS extension for a SAS Viya environment, you will be able to access your connected libraries.

You can use the libraries pane to delete a table, drag and drop tables into your SAS program code, or view a sample of the table data.

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
