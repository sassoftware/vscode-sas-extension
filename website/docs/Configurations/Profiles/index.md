# Profile Definitions and Connection Types

Profiles provide an easy way to switch between multiple SAS deployments. For SAS Viya connections, multiple Viya profiles are used to switch between compute contexts. There is no limit to the number of stored profiles you can create.

You configure the profiles in VS Code and they are stored in the VS Code `settings.json` file. You can update the profile settings, if needed.

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
