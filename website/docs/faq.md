# Frequently Asked Questions

## Usage questions

### Why don't I see correct syntax colors in my SAS code?

Select `File > Preferences > Color Theme` and select a SAS color theme.

### Why don't I see error or note colors in my SAS log​?

Select `File > Preferences > Color Theme` and select a SAS color theme.

### Can I change the default shortcuts to run SAS code?

To manage shortcuts in VS Code, select `File > Preferences > Keyboard Shortcuts`. Enter "run sas" in the search box to view the commands that are associated with running SAS code. Hover the mouse pointer over the column to the left of the command to add or edit a shortcut for the command.

### Can I reduce the number of autocomplete suggestions I'm getting?

To turn off autocomplete suggestions when you enter a trigger character, such as Space, select `File > Preferences > Settings` and enter "trigger" in the search box. Clear the `Suggest On Trigger Characters` checkbox. When this option is disabled, you can still display a code suggestion by entering matched text or by pressing Ctrl+Space.

To change how suggestions are accepted, search for the `Accept Suggestion on Enter` option. To accept changes only when you press Tab, select `off` from the drop-down list.

**Note**: You can specify that any setting changes you make affect only SAS files. For more information, see https://code.visualstudio.com/docs/getstarted/settings#_language-specific-editor-settings

### Can I still get word-based suggestions after enabling the SAS extension?

VS Code provides a default word-based autocompletion for any programming language when there is no language extension installed. When a language extension is installed, however, the default autocomplete feature is no longer available. For more information, see https://github.com/microsoft/vscode/issues/21611

### Why does it take so long to run SAS code the first time?

A new session must be created the first time you run SAS code. Connection time varies depending on the server connection. Subsequent runs within the session should be quicker.

## Connection issues

### How do I get my client ID and secret?

SAS administrators can refer to this [documentation](https://documentation.sas.com/?cdcId=sasadmincdc&cdcVersion=v_052&docsetId=calauthmdl&docsetTarget=n1iyx40th7exrqn1ej8t12gfhm88.htm#n0ce1kz53qzmukn165fzrqdsws3e) for how to generate client IDs.

The client ID needs the `authorization_code` grant type. If you want it to automatically refresh the access token, it also needs the `refresh_token` grant type.

### What do the `unable to verify the first certificate` or `self-signed certificate in certificate chain` errors mean when run my code?

You need to manually trust your server's certificate using the steps below:

1. Get your server's certificate file

   1.1. Access your SAS Viya endpoint with Google Chrome or Microsoft Edge

   1.2. Click the "lock" icon on the left of the URL on the address bar. The site information panel opens.

   1.3. Click "Connection is secure", then click "Certificate is valid". The Certificate Viewer opens.

   1.4. Click the "Details" tab, then click "Export". Select "Base64-encoded ASCII, certificate chain" and save it to a file.

2. For Mac OS, you can install the certificate file into your Keychain Access and trust the certificate. If you are using another operating system or you don't want to add the certificate to your system, open VS Code Settings > `SAS: User Provided Certificates`. Enter the full path of the certificate file.

3. Restart VS Code.

If the steps above do not work, you can bypass the certificate check:

1. Set the environment variable [NODE_TLS_REJECT_UNAUTHORIZED](https://nodejs.org/api/cli.html#node_tls_reject_unauthorizedvalue) to 0 to bypass the certificate check.

2. Shut down all VS Code instances and then restart the application with the updated environment variable. If you are connecting to a remote workspace, set the environment variable on the remote system and terminate all VS Code server processes (for example, run `ps -aux | grep vscode-server` on the remote Linux machine to see the processes).

### Why did I get the `Invalid endpoint` error​?

Please specify the correct protocol. For example, if your SAS Viya server is on https, make sure you included `https://` in your `endpoint` setting.

### Why did I get the `Unable to parse decrypted password` error​?

- For Microsoft Windows, open the Control Panel and navigate to `All Control Panel Items\Credential Manager`, click `Windows Credentials`, Select items that start with `vscodesas` and click `Remove`. Restart VS Code.

- For Mac OS, open `Keychain Access`, select `login` keychain and then select `Passwords`. Right-click any items that start with `vscodesas` and select `Delete`. Restart VS Code.

### Why did I get the `Setup error: Retrieving the COM class factory`... error when connecting to SAS 9.4 (remote-IOM)?

Confirm if SAS Integration Technologies Client is successfully installed. Refer to the [documentation](./Configurations/Profiles/sas9iom.md) for details.

### I got the `See console log for more details` error. How do I find the console log?​

Click `Help > Toggle Developer Tools` from the top menu bar.

### How do I debug connection failures?

The console log includes detailed errors and warnings that you can use to help debug problems with your connection. To open the console log, click `Help > Toggle Developer Tools` from the top menu bar.

If you need more help, you can enter a GitHub issue by clicking https://github.com/sassoftware/vscode-sas-extension/issues/new/choose and filling out the form. Be sure to include the errors and warnings from the console log.

### Why am I getting blank errors?

Restart your VS Code session.

## Problems Panel questions

### Can I change the sort order of the messages in the Problems panel?

No, you cannot change the order in which the messages are displayed in the Problems panel. The items are sorted first by severity and then by order of their appearance in the log.

### What does the Show Infos option in the Filters menu do?

The Show Infos option is not implemented in the SAS extension.

### How do I access the toolbar options on the Problems panel when I am displaying a second panel side-by-side?

If the options on the Problems panel toolbar are not visible, you can display the options by clicking the Problems panel to make it the active panel or by hovering your mouse pointer over the Problems panel toolbar.

### Can I control whether errors and warnings from my SAS log are displayed in the Problems panel?

Yes. The `SAS.problems.log` setting controls whether problems from the SAS log are displayed in the Problems panel. This option is enabled by default. To access this option, select `File > Preferences > Settings`, and search for "sas problems".
