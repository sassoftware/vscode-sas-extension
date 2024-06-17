# Configuring the SAS Extension

Before running SAS code, you must configure the SAS extension to access a SAS 9.4 (remote or local) server or a SAS Viya server. You must license SAS 9.4 or SAS Viya to run SAS code.

To configure the SAS extension:

1. Open a SAS program file.

2. Click "No Profile" in the status bar on the bottom left of your VS Code window.

   You can also open the command palette (`F1`, or `Ctrl+Shift+P` on Windows or Linux, or `Shift+CMD+P` on OSX) and locate `SAS: Add New Connection Profile` command.

   ![No Active Profiles Found](/images/NoActiveProfilesStatusBar.png)

3. Follow the instructions in the [Add New Connection Profile](./Profiles/index.md#add-new-connection-profile) section to add a profile.

4. After you have created a profile, the Status Bar Item changes from "No Profile" to the name of the new profile.

   ![Status Bar Profile](/images/StatusBarProfileItem.png)

5. If you do not want to generate results in HTML format, clear the `Enable/disable ODS HTML5 output` setting. This option is enabled by default.
