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
- Switch to the `Run and Debug` view in the VS Code Activity Bar (Ctrl+Shift+D).
- Select `Launch Client` from the drop down (if it is not already).
- Press ▷ to run the launch config (F5).
- In the [Extension Development Host] instance of VS Code, open a SAS file.
- _Optional_: If you want to debug the language server as well, also run the launch configuration `Attach to Server`.

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

| Language                  | VSCode Language ID | Contributor                                       |
| ------------------------- | ------------------ | ------------------------------------------------- |
| **Chinese (Simplified)**  | zh-cn              | Wei Wu, XiangYu Chen                              |
| **Chinese (Traditional)** | zh-tw              | William Huang                                     |
| **French**                | fr                 | Valerie Law, Vincent Rejany                       |
| **German**                | de                 | Susan Hergenhahn, David Weik                      |
| **Italian**               | it                 | Lorenzo Roccato, Simone Spagnoli, Patrizia Omodei |
| **Japanese**              | ja                 | Miori Oiunuma                                     |
| **Korean**                | ko                 | Meilan Ji, SoYoung Huh                            |
| **Polish**                | pl                 | Magda Posnik-Wiech                                |
| **Portuguese (Brazil)**   | pt-br              | Larissa Lima                                      |
| **Spanish**               | es                 | Elyana Mastache, Raquel Nunez                     |

## Run single test file

- Open the `.test.ts` file you want to run
- Switch to the `Run and Debug` view in the VS Code Activity Bar (Ctrl+Shift+D).
- Select `Language Server E2E Test` from the drop down.
- Press ▷ to run the launch config (F5).
- See test result in the `Debug Console` panel.

## Update documentation

The `website` directory powers the [documentation website](https://sassoftware.github.io/vscode-sas-extension/). Update the markdown files in `website/docs/` directory. It will be built to the website when pushed to the `main` branch. See its [README](./website/README.md) for details.

# Testing unpublished versions

You can still try out any commit or pull request (PR) if you don't want to manually build from source code.

## Download VSIX file

- Open below page with your browser
  - For main branch https://github.com/sassoftware/vscode-sas-extension/actions/workflows/package.yml
  - For Pull Request https://github.com/sassoftware/vscode-sas-extension/actions/workflows/pr.yml
- Select the commit/PR you want.
- Download the `artifact.zip` file from the Artifacts section.
- Unzip it to get the VSIX file.

## Install VSIX file

- Open the `Extensions` view on the VS Code Activity Bar.
- Click the `...` from the top right of the Extensions pane, and select `Install from VSIX...`, select the downloaded VSIX file.
- Restart VS Code

**Note**:

- When testing VSIX files, it's usually a good idea to turn off "Extensions: Auto Update" in your VS Code settings to prevent auto-updating to a published version.
- When switching between multiple VSIX files, it's usually a good idea to clean up the [installation directory](https://code.visualstudio.com/docs/editor/extension-marketplace#_where-are-extensions-installed) after uninstalling a previous version. Otherwise VS Code may cache it as un-published versions may look same.
