---
sidebar_position: 5
---

# SAS 9.4 (local - stdio) Connection Profile

The SAS 9.4 (local - stdio) connection type allows you to run SAS locally on your machine using standard input/output pipes (stdin/stdout/stderr) instead of SSH. This connection type provides the same interactive SAS session semantics as the SSH connection type but without network overhead.

## When to Use Stdio

Use the stdio connection type when:

- SAS is installed locally on the same machine as VS Code
- You want to avoid SSH connection overhead
- You're working on a single-user development machine

## Requirements

- SAS 9.4 must be installed locally on your machine (or inside Docker container)
- The SAS executable must be accessible via a fully qualified path
- Your operating system must be Linux (other OS were not tested)

## Profile Anatomy

A SAS 9.4 (local - stdio) connection profile includes the following parameters:

`"connectionType": "stdio"`

| Name      | Description                  | Additional Notes                                             |
| --------- | ---------------------------- | ------------------------------------------------------------ |
| `saspath` | Path to local SAS Executable | Must be a fully qualified path on your local machine to SAS. |

## Example Configuration

To create a stdio connection profile, add an entry to your VS Code settings:

```json
{
  "SAS.connectionProfiles": {
    "profiles": {
      "local_sas": {
        "connectionType": "stdio",
        "saspath": "/usr/local/SASHome/SASFoundation/9.4/bin/sas_u8"
      }
    },
    "activeProfile": "local_sas"
  }
}
```

### With Additional SAS Options

You can include SAS startup options in your profile:

```json
{
  "SAS.connectionProfiles": {
    "profiles": {
      "local_sas_custom": {
        "connectionType": "stdio",
        "saspath": "/usr/local/SASHome/SASFoundation/9.4/bin/sas_u8",
        "sasOptions": ["-memsize", "2G", "-work", "/tmp/saswork"]
      }
    },
    "activeProfile": "local_sas_custom"
  }
}
```

### With AutoExec

You can configure AutoExec lines to run automatically when the session starts:

```json
{
  "SAS.connectionProfiles": {
    "profiles": {
      "local_sas_autoexec": {
        "connectionType": "stdio",
        "saspath": "/usr/local/SASHome/SASFoundation/9.4/bin/sas_u8",
        "autoExec": [
          {
            "type": "line",
            "line": "options pagesize=max;"
          },
          {
            "type": "file",
            "filePath": "/home/user/my_autoexec.sas"
          }
        ]
      }
    },
    "activeProfile": "local_sas_autoexec"
  }
}
```

## How It Works

The stdio connection type:

1. Spawns a local SAS process
2. Opens stdin, stdout, and stderr pipes to communicate with SAS
3. Maintains a persistent SAS session across multiple code submissions
4. Streams logs in real-time. Outputs are directly opened from filesystem

This provides identical behavior to the SSH connection type, but without requiring a remote server or SSH authentication.

## Common SAS Executable Paths

The location of the SAS executable varies by installation. Common paths include:

### Linux/Unix

```
/opt/sasinside/SASHome/SASFoundation/9.4/bin/sas_u8
/usr/local/SASHome/SASFoundation/9.4/bin/sas_u8
```

Check with your SAS administrator or installation documentation for the exact path on your system.

## Comparison with SSH Connection

| Feature                    | SSH Connection | Stdio Connection |
| -------------------------- | -------------- | ---------------- |
| Session persistence        | ✅             | ✅               |
| Incremental code execution | ✅             | ✅               |
| Real-time log streaming    | ✅             | ✅               |
| ODS output                 | ✅             | ✅               |
| Requires remote server     | ✅             | ❌               |
| Requires authentication    | ✅             | ❌               |
| Network overhead           | ✅             | ❌               |
| Local SAS installation     | ❌             | ✅               |

## Troubleshooting

### Connection Fails to Start

If the SAS process fails to start, verify:

1. The `saspath` is correct and points to a valid SAS executable
2. You have execute permissions on the SAS executable
3. SAS is properly licensed on your local machine

### Session Behaves Unexpectedly

- Check that your SAS options are valid
- Review the SAS log for error messages
- Ensure your WORK directory has sufficient space
- Verify that AutoExec files (if specified) are accessible and valid

## See Also

- [Add New Connection Profile](./index.md#add-new-connection-profile)
- [SAS 9.4 (remote - SSH) Connection Profile](./sas9ssh.md)
- [Managing Connection Profiles](./index.md)
