# How to Contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## Agreement Covering Contributions

Contributions are subject to the Apache License Version 2.0, a copy of which is included as [LICENSE](LICENSE)

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

Please make sure your submission passed the `lint`, `format:check` and `test` tasks clean.

### Creating a pull request description

There are two parts to a pull request description: Summary and Testing.

#### Summary

Use this as a space to provide details about your new feature. Your summary should primarily focus on what has changed, and why it has changed.

#### Testing

For each pull request, you are expected to test the defaults to make sure no regressions were introduced as part of your change. When adding new features, you are expected to add new test cases that cover the new functionality.

# Development

## Structure

```
.
├── client // Language Client
│   ├── src
|   |   └── browser
│   │   |   └── extension.ts // Language Client entry point for browser
|   |   └── node
│   │       └── extension.ts // Language Client entry point for electron
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        └── browser
        |   └── server.ts // Language Server entry point for browser
        └── node
            └── server.ts // Language Server entry point for electron
```

## Get started

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder.
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`.
- In the [Extension Development Host] instance of VSCode, open a SAS file.
