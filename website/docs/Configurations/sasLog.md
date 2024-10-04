# SAS Log

You can customize when the SAS log is displayed in the bottom panel by using the following extension settings. These settings apply to all connection profiles:

| Name                            | Description                        | Additional Notes |
| ------------------------------- | ---------------------------------- | ---------------- |
| `SAS.log.showOnExecutionStart`  | Show SAS log on start of execution | default: `true`  |
| `SAS.log.showOnExecutionFinish` | Show SAS log on end of execution   | default: `true`  |

To access the SAS settings, select `File > Preferences > Settings`. Search for "sas" and then click SAS in the search results to view the SAS extension settings. You can edit the settings directly in the `settings.json` file by clicking `Edit in settings.json`.

Example

```json title="settings.json"
{
  "SAS.log.showOnExecutionFinish": true,
  "SAS.log.showOnExecutionStart": false,
  "SAS.connectionProfiles": {
    "activeProfile": "viyaServer",
    "profiles": {
      "viya4": {
        "endpoint": "https://example-endpoint.com",
        "connectionType": "rest",
        "sasOptions": ["NONEWS", "ECHOAUTO"],
        "autoExec": [
          {
            "type": "line",
            "line": "ods graphics / imagemap;"
          },
          {
            "type": "file",
            "filePath": "/my/local/autoexec.sas"
          }
        ]
      }
    }
  }
}
```

:::tip

To view the SAS log as a text file, click the `...` icon on the top right of the OUTPUT panel, and select `Open Output in Editor`.

:::
