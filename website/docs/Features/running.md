# Running SAS Code

After you configure the SAS extension for your SAS environment, you can run your SAS program and view the log and results. The steps to connect to SAS and run your program are different for SAS Viya and SAS 9.

## SAS Viya

To run a SAS program with a SAS Viya connection:

1. Click the ![running person](../../../icons/light/submitSASCode.svg#gh-light-mode-only)![running person](../../../icons/dark/submitSASCode.svg#gh-dark-mode-only) icon in the upper right corner of your SAS program window.
2. For a secure connection to SAS Viya, you must connect with an authorization code:

   2.1. If VS Code prompts you to sign in using SAS, click 'Allow'.

   2.2. If VS Code prompts you to open an external website, click 'Open'. A new browser window opens so that you can log on to SAS.

   2.3. Log on with your SAS credentials.

   2.4. SAS returns an authorization code. Copy this code.

   2.5. Paste the authorization code in the authorization box at the top of the VS Code application.

3. VS Code connects to SAS and runs the code.

4. The results are displayed in the application.

5. The SAS output log and error information are displayed in the application.

![runCode2](/images/runCode2.png)

:::info

Your sign in status will persist in VS Code. You can view it and sign out from VS Code's `Accounts` menu.

:::

## SAS 9.4

1. Click the ![running person](../../../icons/light/submitSASCode.svg#gh-light-mode-only)![running person](../../../icons/dark/submitSASCode.svg#gh-dark-mode-only) icon in the upper right corner of your SAS program window.

2. VS Code connects to SAS and runs the code.

3. The results, log, and error status are displayed in the application.

## Additional notes

To run a selection of SAS code:

- The `Run Selected or All SAS Code` command (`F3`) will automatically run selected code when you have selected lines of code in a program. If you have not selected any lines of code, SAS runs the entire program.
- If you have selected multiple sections of code, the `Run Selected or All SAS Code` command combines the code from the selections in the order in which they were selected, and then submits the combined code.
- The `Run All SAS Code` command (`F8`) always runs the entire program.

**Notes**:

- A new session must be created the first time you run SAS code. Connection time will vary depending on the server connection.
- Currently, only HTML output is supported. By default, the ODS HTML5 statement is added to the submitted code. Clear the `Enable/disable ODS HTML5 output` option in the Settings editor for the SAS extension to disable this output.
- When you click `Run`, the code in the active tab in the editor is submitted. Make sure that the correct tab is active when you run your program.
- To reset your connection to SAS, run the `Close Current Session` command in VS Code or click the `Close Session` button from the tooltip of the active profile status bar item.
