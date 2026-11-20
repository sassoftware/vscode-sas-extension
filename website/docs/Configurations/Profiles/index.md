# Profile Definitions and Connection Types

Profiles provide an easy way to switch between multiple SAS deployments. For SAS Viya connections, multiple Viya profiles are used to switch between compute contexts. There is no limit to the number of stored profiles you can create.

You configure the profiles in VS Code and they are stored in the VS Code `settings.json` file. You can update the profile settings, if needed.

## Profile Configuration Scope

Connection profiles can be defined in either User settings or Workspace settings (for example, a workspace `.vscode/settings.json` file or a saved `.code-workspace` file).

Example workspace configuration:

```json
{
  "SAS.connectionProfiles": {
    "activeProfile": "workspaceProfile",
    "profiles": {
      "workspaceProfile": {
        "connectionType": "rest",
        "endpoint": "https://my-sas-server.company.com"
      }
    }
  }
}
```

Example multi-root workspace configuration (`.code-workspace`):

```json
{
  "folders": [{ "path": "FolderA" }, { "path": "FolderB" }],
  "settings": {
    "SAS.connectionProfiles": {
      "activeProfile": "ws_One",
      "profiles": {
        "ws_One": {
          "connectionType": "rest",
          "endpoint": "https://my-sas-server.company.com"
        },
        "ws_Two": {
          "connectionType": "rest",
          "endpoint": "https://my-sas-server.company.com"
        }
      }
    }
  }
}
```

In a saved multi-root workspace, `SAS.connectionProfiles` can be defined in the workspace `.code-workspace` file under the `settings` section. When defined, the workspace profile collection takes precedence over the User profile collection.

When `SAS.connectionProfiles` is defined in both scopes, the Workspace profile
collection takes precedence over the User profile collection.

Profile management operations such as:

- Add Profile
- Switch Profile
- Update Profile
- Delete Profile

operate on the configuration scope that currently owns
`SAS.connectionProfiles`.

If `SAS.connectionProfiles` is not defined in Workspace settings, the
extension uses the User profile collection.

The SAS extension does not merge profile collections across configuration
scopes. Profiles are resolved from a single profile collection at a time.

For example:

- If both User and Workspace settings define `SAS.connectionProfiles`, the
  Workspace profile collection is used.
- If `SAS.connectionProfiles` is not defined in Workspace settings, the
  extension uses the User profile collection.

## Empty Profile Collections

An empty profile collection still indicates ownership of the
`SAS.connectionProfiles` setting.

For example, both of the following configurations are considered valid empty
profile collections:

```json
{
  "SAS.connectionProfiles": {}
}
```

```json
{
  "SAS.connectionProfiles": {
    "activeProfile": "",
    "profiles": {}
  }
}
```

When one of these configurations exists in Workspace settings, the Workspace
profile collection remains the active profile source.

To use the User profile collection again, remove the SAS.connectionProfiles setting from Workspace settings.

A profile collection can contain multiple SAS connection profiles. The active connection is determined by the `activeProfile` setting within the currently resolved profile collection. The `Switch Profile` command updates the `activeProfile` value for that collection.

The following commands are supported for profiles:

| Command             | Title                                  |
| ------------------- | -------------------------------------- |
| `SAS.addProfile`    | SAS: Add New Connection Profile        |
| `SAS.switchProfile` | SAS: Switch Current Connection profile |
| `SAS.updateProfile` | SAS: Update Connection profile         |
| `SAS.deleteProfile` | SAS: Delete Connection profile         |

## Add New Connection Profile

1. Open the command palette (`F1`, or `Ctrl+Shift+P` on Windows or Linux, or `Shift+CMD+P` on OSX) and execute the `SAS.addProfile` command.

2. Select a connection type and complete the prompts to create a new profile.

## Delete Connection Profile

After executing the `SAS.deleteProfile` command:

1. Select a profile to delete from the list of profiles

2. A notification message is displayed when the profile is successfully deleted.

## Switch Current Connection Profile

After executing the `SAS.switchProfile` command:

1. Select a profile to set active from the list of profiles. If no profiles can be found, the extension prompts you to [create a new profile](#add-new-connection-profile)

2. The StatusBar is updated to display the name of the selected profile

## Update Connection Profile

After executing the `SAS.updateProfile` command:

1. Select a profile to update from the list of profiles.

2. Complete the prompts to update the profile.

To update the name of a profile, you must delete and recreate the profile.
