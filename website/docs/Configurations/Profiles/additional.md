# Additional Profile Settings

## SAS Options Settings Examples

SAS system options can be set for each connection profile. Changes to the SAS system options do not take effect until you close and restart your SAS session. See the following examples of the required formats for the supported connection profile types.

- SAS Viya:

  ```json
  {
    "profiles": {
      "viya4": {
        "endpoint": "https://example-endpoint.com",
        "connectionType": "rest",
        "sasOptions": ["NONEWS", "ECHOAUTO", "PAGESIZE=MAX"]
      }
    }
  }
  ```

- SAS 9.4 (remote - IOM):

  ```json
  {
    "profiles": {
      "sas9IOM": {
        "host": "host",
        "username": "username",
        "port": 8591,
        "sasOptions": ["NONEWS", "ECHOAUTO", "PAGESIZE=MAX"],
        "ConnectionType": "iom"
      }
    }
  }
  ```

- SAS 9.4 (local):

  ```json
  {
    "profiles": {
      "sas9COM": {
        "host": "localhost",
        "sasOptions": ["NONEWS", "ECHOAUTO", "PAGESIZE=MAX"],
        "ConnectionType": "com"
      }
    }
  }
  ```

- SAS 9 (remote - SSH):

  ```json
  {
    "profiles": {
      "SAS9SSH": {
        "host": "hostname",
        "username": "username",
        "port": 22,
        "sasPath": "/remote/path/to/sas_u8",
        "sasOptions": ["-NONEWS", "-ECHOAUTO", "-PAGESIZE MAX"],
        "connectionType": "ssh"
      }
    }
  }
  ```

## SAS Autoexec Settings

For SAS Viya connection profiles, you can set up autoexec code that executes each time you start a new session. Changes to the autoexec code do not take effect until you close and restart your SAS session. The Autoexec option supports different modes for how to define the SAS lines that should run:

- Line Mode: embed lines directly into the connection profile JSON. This mode is useful if only a few lines are needed to run on session startup. Note that standard JSON escaping rules apply.

  ```json
  "SAS.connectionProfiles": {
    "activeProfile": "viyaServer",
    "profiles": {
      "viya4": {
        "endpoint": "https://example-endpoint.com",
        "connectionType": "rest",
        "autoExec": [
          {
            "type": "line",
            "line": "ods graphics / imagemap;"
          }
        ]
      }
    }
  }
  ```

- File Mode: specify a path to a file containing autoexec lines to execute. The file must be in a location that is readable by the extension. This mode is useful for complex autoexec scenarios:

  ```json
  "SAS.connectionProfiles": {
    "activeProfile": "viyaServer",
    "profiles": {
      "viya4": {
        "endpoint": "https://example-endpoint.com",
        "connectionType": "rest",
        "autoExec": [
          {
            "type": "file",
            "filePath": "/my/local/autoexec.sas"
          }
        ]
      }
    }
  }
  ```

- Mixed Mode: The autoexec option supports an array of entries, so it is possible to use a combination of both embedded lines and files. The lines will be read in sequential order as they occur in the array itself.

  ```json
  "SAS.connectionProfiles": {
    "activeProfile": "viyaServer",
    "profiles": {
      "viya4": {
        "endpoint": "https://example-endpoint.com",
        "connectionType": "rest",
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
  ```

## SAS Interop Library Settings

SAS Interop library settings can be configured for ITC-based connections ("remote - IOM" and "local" connection types). ITC-based connections have a dependency on `SASInterop.dll` and `SASOManInterop.dll`. The extension tries to load these libraries from the following locations (ordered by priority):

1. The path specified in `interopLibraryFolderPath`. This should be an absolute path to the folder containing the files listed above.
2. If `interopLibraryFolderPath` is empty or invalid, the extension will attempt to resolve the path from Windows registry
3. If steps 1 and 2 fail, the extension will attempt to load libraries from the default Integration Technologies Client folder (`C:\Program Files\SASHome\x86\Integration Technologies`)

The following demonstrates how to setup `interopLibraryFolderPath` in user settings:

- SAS 9.4 (remote - IOM):

  ```json
  {
    "profiles": {
      "sas9IOM": {
        "host": "host",
        "username": "username",
        "port": 8591,
        "ConnectionType": "iom",
        "interopLibraryFolderPath": "C:\\Program Files\\SASHome\\x86\\Integration Technologies"
      }
    }
  }
  ```

- SAS 9.4 (local):

  ```json
  {
    "profiles": {
      "sas9COM": {
        "host": "localhost",
        "ConnectionType": "com",
        "interopLibraryFolderPath": "C:\\Program Files\\SASHome\\x86\\Integration Technologies"
      }
    }
  }
  ```

## SAS Server File Navigation Root Settings

SAS Server File Navigation Root Settings can be configured for ITC-based connections ("remote - IOM" and "local" connection types) and Viya connections. Two settings are available:

- `fileNavigationRoot`: This can be set to USER (default), SYSTEM, or CUSTOM. When using a "CUSTOM" root, you'll need to specify `fileNavigationCustomRootPath`
- `fileNavigationCustomRootPath`: The absolute path to the folder to use as your root directory.

These user-defined settings can be overwritten in Viya environments by a SAS administrator. If the options above are specified in the context definition for the SAS Compute Server, they will be prioritized over user settings. The following screenshot provides an example context definition setup:
![context definition setup for file navigation root settings](/images/context-definition.png)

The following demonstrates how to setup `fileNavigationCustomRootPath`/`fileNavigationRoot` in user settings:

- SAS Viya:

  ```json
  {
    "profiles": {
      "viya4": {
        "endpoint": "https://example-endpoint.com",
        "connectionType": "rest",
        "sasOptions": ["NONEWS", "ECHOAUTO", "PAGESIZE=MAX"],
        "fileNavigationCustomRootPath": "/custom/file/path",
        "fileNavigationRoot": "CUSTOM"
      }
    }
  }
  ```

- SAS 9.4 (remote - IOM):

  ```json
  {
    "profiles": {
      "sas9IOM": {
        "host": "host",
        "username": "username",
        "port": 8591,
        "ConnectionType": "iom",
        "fileNavigationRoot": "SYSTEM"
      }
    }
  }
  ```

- SAS 9.4 (local):

  ```json
  {
    "profiles": {
      "sas9COM": {
        "host": "localhost",
        "ConnectionType": "com",
        "fileNavigationCustomRootPath": "C:\\Users\\User\\Documents",
        "fileNavigationRoot": "CUSTOM"
      }
    }
  }
  ```
