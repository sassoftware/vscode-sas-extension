# Changelog

## TBD

### Breaking Change

- "Authorization code" grant is applied now. Password and token file approach has been removed. Your client ID need to be registered with "authorization_code" and "refresh_token" grant type now.

### Feature

- Login with SASLogon with PKCE
- Refresh your access token with refresh token
- Built-in client ID for Viya4 2022.11 and later

## v0.1.0 (8 Oct 2022)

### Breaking Change

- Command ID `SAS.session.run` and `SAS.session.runSelected` changed to `SAS.run` and `SAS.runSelected`
- Settings `SAS.session.host`, `SAS.session.clientId`, etc. migrated to `SAS.connectionProfiles`

### Feature

- Support connection profiles

### Fix

- Improve macro statement autocomplete
- Percentage sign should escape quotes in %str
- PROC SQL snippet syntax

## v0.0.7 (26 Jul 2022)

### Feature

- Support run selected SAS code

## v0.0.6 (8 Jul 2022)

### Fix

- It now recovers from syntax check mode on each run
- Correct syntax highlighting for name literal

### Themes

- SAS themes provide default colors to non-SAS languages
- SAS syntax have basic type colors in non-SAS themes

### Doc

- Update README to show animated gifs

## v0.0.5 (26 May 2022)

### Fix

- Compute context not found error in some cases. User can now specify a compute context name to use.

### Chore

- Rearrange settings fields
- Update dependencies versions

## v0.0.4 (19 May 2022)

### Fix

- Fixed blank error in some cases

### Doc

- Update README.md to link to wiki

## v0.0.3 (17 May 2022)

Initial release
