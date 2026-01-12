# stdio Connection Type Implementation

This directory contains the implementation of the `stdio` connection type for the VS Code SAS Extension.

## What is stdio?

The `stdio` connection type allows you to run SAS locally using standard input/output pipes instead of SSH. It provides the same persistent session behavior as SSH but without requiring a remote server or network connection.

## Quick Start

### 1. Create a stdio Profile

Add to your VS Code settings (`.vscode/settings.json` or user settings):

```json
{
  "SAS.connectionProfiles": {
    "profiles": {
      "my_local_sas": {
        "connectionType": "stdio",
        "saspath": "/opt/sasinside/SASHome/SASFoundation/9.4/bin/sas_u8"
      }
    },
    "activeProfile": "my_local_sas"
  }
}
```

### 2. Or Use the UI

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Run: `SAS: Add New Connection Profile`
3. Select: `SAS 9.4 (local - stdio)`
4. Enter your SAS executable path

## How It Works

```
VS Code Extension
      ↓
   spawn()
      ↓
  SAS Process (stdin/stdout/stderr)
      ↓
  Interactive Session
```

- Extension spawns local SAS with `-stdio` flag
- Code written to stdin
- Logs/output stream back via stdout/stderr
- Session persists across multiple submissions
- State (WORK tables, macros, options) maintained

## Comparison

| Feature     | SSH              | stdio          |
| ----------- | ---------------- | -------------- |
| Location    | Remote           | Local          |
| Auth        | Required         | None           |
| Session     | Persistent       | Persistent     |
| Performance | Network overhead | Direct process |

## Files

- `index.ts` - Main implementation
- `const.ts` - Constants
- `types.ts` - Type definitions

## Testing

Unit tests located at: `/client/test/connection/stdio/index.test.ts`

## Documentation

User documentation: `/website/docs/Configurations/Profiles/sas9stdio.md`

## Example Configurations

See: `/doc/profileExamples/stdio-profile-example.json`
