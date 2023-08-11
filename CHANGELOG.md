# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). If you introduce breaking changes, please group them together in the "Changed" section using the **BREAKING:** prefix.

## [v1.2.0] - 2023-08-11

### Added

- Auto-completion follows user's typing case ([#430](https://github.com/sassoftware/vscode-sas-extension/pull/430))

### Fixed

- Fixed column icons for data viewer ([#443](https://github.com/sassoftware/vscode-sas-extension/pull/443))

## [v1.1.0] - 2023-08-04

### Added

- Ability to specify SAS options for session startup ([#339](https://github.com/sassoftware/vscode-sas-extension/pull/339))
- Autoexec support for Viya connection ([#355](https://github.com/sassoftware/vscode-sas-extension/pull/355))
- Show session startup log ([#380](https://github.com/sassoftware/vscode-sas-extension/pull/380))
- Added the ability to download tables from the libraries view ([#395](https://github.com/sassoftware/vscode-sas-extension/pull/395))
- Simplified Chinese translation ([#409](https://github.com/sassoftware/vscode-sas-extension/pull/409))
- (Engineering) Added support for `npm run copyright:check --fix`. This automatically prepends files with the correct copyright information. ([#344](https://github.com/sassoftware/vscode-sas-extension/pull/344))
- (Engineering) l10n infrastructure ([#370](https://github.com/sassoftware/vscode-sas-extension/pull/370))

### Changed

- Changed Data viewer to use AG Grid instead of VSCode data grid. Our data viewer now support infinite paging for large tables, a fixed header, and type icons for columns ([#395](https://github.com/sassoftware/vscode-sas-extension/pull/395))

### Fixed

- Result not shown when having many pages ([#330](https://github.com/sassoftware/vscode-sas-extension/issues/330))
- Ability to cancel profile update ([#389](https://github.com/sassoftware/vscode-sas-extension/issues/389))
- Local COM hang in zh-cn locale ([#346](https://github.com/sassoftware/vscode-sas-extension/issues/346))
- SAS Log partially lost ([#420](https://github.com/sassoftware/vscode-sas-extension/issues/420))
- SAS Content error on Viya 2023.03 ([#328](https://github.com/sassoftware/vscode-sas-extension/issues/328))
- (Engineering) Fixed an issue with `npm run copyright:check` where some files were not being validated. ([#344](https://github.com/sassoftware/vscode-sas-extension/pull/344))

## [v1.0.0] - 2023-06-16

### Added

- Support SAS 9 Local via COM ([#11](https://github.com/sassoftware/vscode-sas-extension/issues/11))
- Support SAS Notebook ([#174](https://github.com/sassoftware/vscode-sas-extension/issues/174))
- Support Add to My Favorites and Remove from My Favorites action ([#283](https://github.com/sassoftware/vscode-sas-extension/issues/283))
- Support Drag & Drop for SAS content ([#310](https://github.com/sassoftware/vscode-sas-extension/issues/310))
- Support Canceling running job ([#187](https://github.com/sassoftware/vscode-sas-extension/issues/187))

### Changed

- Changed license to official Apache License, Version 2.0 ([#341](https://github.com/sassoftware/vscode-sas-extension/pull/341))

### Fixed

- 406 error for library view on Viya 3.5 ([#300](https://github.com/sassoftware/vscode-sas-extension/issues/300))

## [v0.1.5] - 2023-05-19

### Added

- Allow user to provide trusted CA certificates ([#220](https://github.com/sassoftware/vscode-sas-extension/issues/220))
- Support Run Region ([#222](https://github.com/sassoftware/vscode-sas-extension/issues/222))
- Infinite scrolling for data table ([#199](https://github.com/sassoftware/vscode-sas-extension/pull/199))
- Updated folder icons ([#214](https://github.com/sassoftware/vscode-sas-extension/issues/214))

### Fixed

- Errors for libraries view in some cases ([#250](https://github.com/sassoftware/vscode-sas-extension/issues/250)), ([#252](https://github.com/sassoftware/vscode-sas-extension/issues/252))
- Let built-in suggestions popup in some cases ([#259](https://github.com/sassoftware/vscode-sas-extension/issues/259))
- Show user acount information correctly ([#235](https://github.com/sassoftware/vscode-sas-extension/issues/235))
- Updated syntax data ([#249](https://github.com/sassoftware/vscode-sas-extension/issues/249))

## [v0.1.4] - 2023-04-28

### Fixed

- Fixed an issue where trailing slashes on viya endpoints caused connection issues ([#232](https://github.com/sassoftware/vscode-sas-extension/pull/232))
- Added back the F3 (Run Selected) and F8 (Run All) keyboard shortcuts ([#230](https://github.com/sassoftware/vscode-sas-extension/issues/230), [#231](https://github.com/sassoftware/vscode-sas-extension/pull/231))
- Sort the folder children in Explorer pane alphabetically and case-insensitively, folders first ([#225](https://github.com/sassoftware/vscode-sas-extension/issues/225))
- Fixed an issue where preview mode wasn't working as expected when opening files in sas content ([#224](https://github.com/sassoftware/vscode-sas-extension/issues/224), [#243](https://github.com/sassoftware/vscode-sas-extension/pull/243))

## [v0.1.3] - 2023-04-13

### Added

- Authentication status now persisted in VS Code ([#94](https://github.com/sassoftware/vscode-sas-extension/issues/94), [#110](https://github.com/sassoftware/vscode-sas-extension/pull/110))
- Added support for running SAS code on a remote 9.4 linux server using ssh and -nodms ([#61](https://github.com/sassoftware/vscode-sas-extension/issues/61), [#155](https://github.com/sassoftware/vscode-sas-extension/issues/155), [#186](https://github.com/sassoftware/vscode-sas-extension/issues/186))
- Migrate legacy profiles to use new connectionType property ([#157](https://github.com/sassoftware/vscode-sas-extension/issues/157))
- Updated error message for unsupported connection type ([#151](https://github.com/sassoftware/vscode-sas-extension/issues/151))
- Added SAS content navigator. You are now able to browse, edit, create, delete, and run files on a SAS server using a Viya connection ([#56](https://github.com/sassoftware/vscode-sas-extension/issues/56), [#162](https://github.com/sassoftware/vscode-sas-extension/pull/162), [#176](https://github.com/sassoftware/vscode-sas-extension/pull/176), [#193](https://github.com/sassoftware/vscode-sas-extension/pull/193))
- Added support for SAS libraries. You are now able to see libraries and tables from a SAS instance. You are also able to delete, view, and drag tables into your sas programs. ([#129](https://github.com/sassoftware/vscode-sas-extension/issues/129))
- Update syntax colors ([#153](https://github.com/sassoftware/vscode-sas-extension/pull/153))

## [v0.1.2] - 2023-02-01

### Changed

- The `Run Selected SAS Code` command changed to `Run Selected or All SAS Code`. It will run selected code when there's a selection, and run all code when there's no selection #50, #51
- The running man icon changed to `Run Selected or All SAS Code` #50, #51

### Added

- When there're multiple selections, the `Run Selected or All SAS Code` command will combine all the selected code and submit #50, #51
- Added default shortcuts, `F3` for `Run Selected or All SAS Code`, `F8` for `Run All SAS Code` #50, #51

### Fixed

- Fixed a problem when there is a period in the profile name #43, #44
- Fixed a problem when job running longer than 60 seconds #36, #40
- Only show Result window if result is generated #46, #77
- Run some code, error happened unexpectedly #63, #40

## [v0.1.1] - 2022-11-24

### Changed

- **BREAKING:** Updated extension to require "Authorization code" grant. Your client ID needs to be registered with "authorization_code" and "refresh_token" grant type now.

### Added

- Added login with SASLogon with PKCE
- Added support to refresh access token with refresh token
- Added built-in client ID for Viya4 2022.11 and later

### Removed

- Removed password and token file login approach

## [v0.1.0] - 2022-10-08

### Changed

- **BREAKING:** Changed Command ID `SAS.session.run` and `SAS.session.runSelected` to `SAS.run` and `SAS.runSelected`
- **BREAKING:** Changed Settings `SAS.session.host`, `SAS.session.clientId`, etc. to `SAS.connectionProfiles`

### Added

- Added support for connection profiles

### Fixed

- Improved macro statement autocomplete
- Fixed issue where percentage sign should escape quotes in %str
- Fixed PROC SQL snippet syntax

## [v0.0.7] - 2022-07-26

### Added

- Added support to run selected SAS code

## [v0.0.6] - 2022-07-08

### Fixed

- Fixed extension recovery from syntax check mode on each run
- Corrected syntax highlighting for name literal

### Changed

- Changed SAS themes to provide default colors to non-SAS languages
- Changed SAS syntax to have basic type colors in non-SAS themes
- Updated README to show animated gifs

## [v0.0.5] - 2022-05-26

### Fixed

- Fixed compute context not found error; user can now specify a compute context name to use

### Changed

- Rearranged settings fields
- Updated dependencies versions

## [v0.0.4] - 2022-05-19

### Fixed

- Fixed error parsing/display

### Changed

- Updated README.md to link to wiki

## [v0.0.3] - 2022-05-17

Initial release
