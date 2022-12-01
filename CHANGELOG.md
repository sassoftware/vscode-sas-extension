# Changelog

## [Unreleased]

### Added

- `.gitattributes` to suppress display of generated files.

### Changed

- Changed `CHANGELOG.md` to better match https://keepachangelog.com/en/1.0.0/. Further discussion is needed to determine version note changes for past releases.

## [v0.1.1] - 2022-11-24

### Breaking Change

- "Authorization code" grant is applied now. Password and token file approach has been removed. Your client ID need to be registered with "authorization_code" and "refresh_token" grant type now.

### Feature

- Login with SASLogon with PKCE
- Refresh your access token with refresh token
- Built-in client ID for Viya4 2022.11 and later

## [v0.1.0] - 2022-10-08

### Breaking Change

- Command ID `SAS.session.run` and `SAS.session.runSelected` changed to `SAS.run` and `SAS.runSelected`
- Settings `SAS.session.host`, `SAS.session.clientId`, etc. migrated to `SAS.connectionProfiles`

### Feature

- Support connection profiles

### Fix

- Improve macro statement autocomplete
- Percentage sign should escape quotes in %str
- PROC SQL snippet syntax

## [v0.0.7] - 2022-07-26

### Feature

- Support run selected SAS code

## [v0.0.6] - 2022-07-08

### Fix

- It now recovers from syntax check mode on each run
- Correct syntax highlighting for name literal

### Themes

- SAS themes provide default colors to non-SAS languages
- SAS syntax have basic type colors in non-SAS themes

### Doc

- Update README to show animated gifs

## [v0.0.5] - 2022-05-26

### Fix

- Compute context not found error in some cases. User can now specify a compute context name to use.

### Chore

- Rearrange settings fields
- Update dependencies versions

## [v0.0.4] - 2022-05-19

### Fix

- Fixed blank error in some cases

### Doc

- Update README.md to link to wiki

## [v0.0.3] - 2022-05-17

Initial release
