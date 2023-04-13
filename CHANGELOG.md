# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). If you introduce breaking changes, please group them together in the "Changed" section using the **BREAKING:** prefix.

## [Unreleased]

### Fixed

- Fixed an issue where trailing slashes on viya endpoints caused connection issues ([#232](https://github.com/sassoftware/vscode-sas-extension/pull/232))
- Added back the F3 (Run Selected) and F8 (Run All) keyboard shortcuts ([#230](https://github.com/sassoftware/vscode-sas-extension/issues/230), [#231](https://github.com/sassoftware/vscode-sas-extension/pull/231))

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
