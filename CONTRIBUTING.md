# How to Contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## Contributor License Agreement

Contributions to this project must be accompanied by a signed
[Contributor Agreement](ContributorAgreement.txt).
You (or your employer) retain the copyright to your contribution,
this simply gives us permission to use and redistribute your contributions as
part of the project.

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

- Download and install the current NodeJS LTS version.
- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder.
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`.
- In the [Extension Development Host] instance of VSCode, open a SAS file.

## Adding a new locale

Follow these steps to add a new locale for the SAS Extension for VSCode:

- Follow the instructions in the [Get started](#get-started) section to setup your environment and view results.
- Run `npm run locale --new=<locale>` (the locale specified here will need to be one of https://code.visualstudio.com/docs/getstarted/locales#_available-locales).
- Translate the strings in `package.nls.<locale>.json` and `l10/bundle.l10n.<locale>.json`.
- Install the language pack for your chosen locale and change VSCode's language to the one you're testing.
- Verify your changes using `Launch Client`.
- After you've verified changes, you can create a [pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork) for review.

## Updating a current locale

Follow these steps to update a locale for the SAS Extension for VSCode:

- Follow the instructions in the [Get started](#get-started) section to setup your environment and view results.
- Run `npm run locale --update-locale=<locale>`. This will update `package.nls.<locale>.json` and `l10/bundle.l10n.<locale>.json` with any missing translation keys.
- Update any untranslated strings.
- Verify your changes using `Launch Client`.
- After you've verified changes, you can create a [pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork) for review.

### Locale contributors

| Language                 | VSCode Language ID | Contributor |
| ------------------------ | ------------------ | ----------- |
| **German**               | de                 | David Weik  |
| **Chinese (Simplified)** | zh-cn              | Wei Wu      |
| **Portuguese (Brazil)**  | pt-br              | Mark Jordan |

### Download packaged VSIX files
To install the latest Visual Studio Code extension files, locate the artifact.zip associated with each commit on the page provided below. Once downloaded, unzip the file and manually install it in your local Visual Studio Code.
https://github.com/sassoftware/vscode-sas-extension/actions/workflows/package.yml
