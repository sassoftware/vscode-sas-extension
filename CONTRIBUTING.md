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

## Testing code changes

When adding a new feature, adding tests are encouraged to make sure the extension continues to operate as expected.

### Run single test file

- Open the `.test.ts` file you want to run
- Switch to the `Run and Debug` view in the VS Code Activity Bar (Ctrl+Shift+D).
- Select `Language Server E2E Test` from the drop down.
- Press ▷ to run the launch config (F5).
- See test result in the `Debug Console` panel.

## Code structure/guidance

For more guidance on how to make changes in the SAS Extension for VScode, please refer to the [developer documentation](doc/README.md).
