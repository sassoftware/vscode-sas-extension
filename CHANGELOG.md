# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). If you introduce breaking changes, please group them together in the "Changed" section using the **BREAKING:** prefix.

## [Unreleased]

### Added

- Add support for `fileNavigationCustomRootPath`/`fileNavigationRoot` for rest & iom/com connections ([#1557](https://github.com/sassoftware/vscode-sas-extension/pull/1557))

## [v1.15.0] - 2025-06-10

### Changed

- SAS Providers for OLE DB is now required for SAS 9.4 (local) and SAS 9.4 (remote – IOM) connection type.

### Added

- Add sas file system support for ITC-based (IOM/COM) connections ([#1388](https://github.com/sassoftware/vscode-sas-extension/pull/1388))
- Add Traditional Chinese and Polish translations ([#1453](https://github.com/sassoftware/vscode-sas-extension/pull/1453))

### Fixed

- Show problems at corresponding line ([#1347](https://github.com/sassoftware/vscode-sas-extension/issues/1347)) ([#1378](https://github.com/sassoftware/vscode-sas-extension/issues/1378)) ([#1475](https://github.com/sassoftware/vscode-sas-extension/issues/1475))
- Autocomplete in DATA step ([#1458](https://github.com/sassoftware/vscode-sas-extension/issues/1458))
- `Fold All Regions` in Command Palette don't work ([#1486](https://github.com/sassoftware/vscode-sas-extension/issues/1486))
- Table Viewer optimization in ITC ([#1466](https://github.com/sassoftware/vscode-sas-extension/pull/1466)) ([#1132](https://github.com/sassoftware/vscode-sas-extension/issues/1132))

## [v1.14.0] - 2025-04-28

### Added

- Add application name to ITC-based (IOM/COM) connections ([#762](https://github.com/sassoftware/vscode-sas-extension/issues/762))
- Ability to export SAS Notebook to HTML file ([#1417](https://github.com/sassoftware/vscode-sas-extension/pull/1417))

### Fixed

- Reduce overhead time when running code to Viya ([#1447](https://github.com/sassoftware/vscode-sas-extension/issues/1447))

## [v1.13.1] - 2025-03-04

### Fixed

- SAS log color issue ([#1325](https://github.com/sassoftware/vscode-sas-extension/issues/1325))
- Remove unexpected endsubmit autocomplete ([#1357](https://github.com/sassoftware/vscode-sas-extension/issues/1357))
- Proc Python auto-indent issue ([#1376](https://github.com/sassoftware/vscode-sas-extension/issues/1376))
- Better error display for Rest session creation errors ([#1367](https://github.com/sassoftware/vscode-sas-extension/issues/1367))
- Stop running when close session ([#1390](https://github.com/sassoftware/vscode-sas-extension/pull/1390))

## [v1.13.0] - 2024-12-23

### Changed

- Required VS Code version 1.89 at minimum

### Added

- Python language features inside proc python ([#991](https://github.com/sassoftware/vscode-sas-extension/pull/991))
- Inherit VS Code file icons in SAS Content and Server ([#1310](https://github.com/sassoftware/vscode-sas-extension/pull/1310))
- Display macro name in outline pane ([#1326](https://github.com/sassoftware/vscode-sas-extension/pull/1326))

### Fixed

- Display global option help in data step ([#1282](https://github.com/sassoftware/vscode-sas-extension/issues/1282))
- Unnecessary empty line added by formatter ([#1288](https://github.com/sassoftware/vscode-sas-extension/issues/1288))
- Display context in hover help for data step statement option ([#1306](https://github.com/sassoftware/vscode-sas-extension/issues/1306))
- SAS log code action should not impact others ([#1302](https://github.com/sassoftware/vscode-sas-extension/issues/1302))
- The notebook file is opened incorrectly after renaming ([#1289](https://github.com/sassoftware/vscode-sas-extension/issues/1289))
- Resolve breaking changes by AG Grid 33 ([#1334](https://github.com/sassoftware/vscode-sas-extension/issues/1334))

## [v1.12.0] - 2024-11-25

### Added

- Added username and password support for SSH connection type ([#1126](https://github.com/sassoftware/vscode-sas-extension/pull/1126))
- Added support for SAS server for viya connections ([#1203](https://github.com/sassoftware/vscode-sas-extension/pull/1203))
- Enable find in result pane ([#714](https://github.com/sassoftware/vscode-sas-extension/pull/714))

### Fixed

- Formatting should allow statements between proc python and submit ([#1226](https://github.com/sassoftware/vscode-sas-extension/issues/1226))
- SAS Log isn't shown ([#1243](https://github.com/sassoftware/vscode-sas-extension/issues/1243))
- Bracket matching in macro quote ([#1213](https://github.com/sassoftware/vscode-sas-extension/issues/1213))
- Failed to run code the second time with IOM ([#1266](https://github.com/sassoftware/vscode-sas-extension/issues/1266))
- Should not show hover help on whitespaces ([#1267](https://github.com/sassoftware/vscode-sas-extension/issues/1267))

## [v1.11.0] - 2024-10-09

### Added

- Export sas notebook to sas file ([#1157](https://github.com/sassoftware/vscode-sas-extension/pull/1157))
- Clear log on execution start (with new setting `SAS.log.clearOnExecutionStart`) ([#1168](https://github.com/sassoftware/vscode-sas-extension/pull/1168))

### Fixed

- "Run sas file" tasks do not respect selected code ([#1177](https://github.com/sassoftware/vscode-sas-extension/issues/1177))
- Use builtin default System Option MEMSIZE value rather than hardcoding to 0 ([#1189](https://github.com/sassoftware/vscode-sas-extension/issues/1189))
- Log contents are not rendered properly if trying to switch profile from SSH to other connection types ([#1070](https://github.com/sassoftware/vscode-sas-extension/issues/1070))
- Try to run a SAS file having no contents will lead to console error ([#1201](https://github.com/sassoftware/vscode-sas-extension/issues/1201))
- Formatting proc FEDSQL deletes the content of the proc ([#1202](https://github.com/sassoftware/vscode-sas-extension/issues/1202))

## [v1.10.2] - 2024-08-30

### Fixed

- Code lost when formatting proc python without endsubmit ([#992](https://github.com/sassoftware/vscode-sas-extension/issues/992))
- Library tree view keeps refreshing ([#1022](https://github.com/sassoftware/vscode-sas-extension/issues/1022))
- Table viewer does not display variable names ([#1114](https://github.com/sassoftware/vscode-sas-extension/issues/1114))
- Disable sort UI on table as it does nothing ([#1013](https://github.com/sassoftware/vscode-sas-extension/issues/1013))
- Inconsistency between column title on table viewer and dataset variable name ([#1117](https://github.com/sassoftware/vscode-sas-extension/issues/1117))
- Reset cell log upon cell submit in sasnb ([#1080](https://github.com/sassoftware/vscode-sas-extension/issues/1080))
- Log information are missing in certain case with Viya connection ([#963](https://github.com/sassoftware/vscode-sas-extension/issues/963))
- Get working directory error in IOM connection ([#1163](https://github.com/sassoftware/vscode-sas-extension/issues/1163))

## [v1.10.1] - 2024-07-22

### Fixed

- Auto-indent improvement ([#522](https://github.com/sassoftware/vscode-sas-extension/issues/522)) ([#652](https://github.com/sassoftware/vscode-sas-extension/issues/652))
- Log output by running task ([#1058](https://github.com/sassoftware/vscode-sas-extension/issues/1058))
- Resolve the breaking change introduced by AG Grid 32.0 ([#1096](https://github.com/sassoftware/vscode-sas-extension/issues/1096))
- Library pane crash with option symbolgen ([#1012](https://github.com/sassoftware/vscode-sas-extension/issues/1012))

## [v1.10.0] - 2024-06-18

### Added

- Show problems from SAS log ([#627](https://github.com/sassoftware/vscode-sas-extension/pull/627))
- New [documentation site](https://sassoftware.github.io/vscode-sas-extension/) ([#1030](https://github.com/sassoftware/vscode-sas-extension/pull/1030))

### Fixed

- Fileref OUTFILE should be allowed for COM/IOM ([#868](https://github.com/sassoftware/vscode-sas-extension/issues/868))
- Syntax help issue in special case ([#900](https://github.com/sassoftware/vscode-sas-extension/issues/900)) ([#954](https://github.com/sassoftware/vscode-sas-extension/issues/954))
- IOM connection hang when work dir is long ([#964](https://github.com/sassoftware/vscode-sas-extension/issues/964))
- Support cshell for ssh ([#1005](https://github.com/sassoftware/vscode-sas-extension/issues/1005))
- Fix content type when saving files ([#878](https://github.com/sassoftware/vscode-sas-extension/issues/878))

## [v1.9.0] - 2024-04-30

### Added

- Add data viewer support for IOM/COM connections ([#680](https://github.com/sassoftware/vscode-sas-extension/issues/680))
- SQL/Python/Lua syntax highlighting ([#813](https://github.com/sassoftware/vscode-sas-extension/pull/813))

### Fixed

- Content type for file creation/upload ([#878](https://github.com/sassoftware/vscode-sas-extension/issues/878))
- ods html5 output path to work directory ([#664](https://github.com/sassoftware/vscode-sas-extension/pull/664))
- Log with Error type has no color with Viya connection ([#886](https://github.com/sassoftware/vscode-sas-extension/issues/886))
- Function autocomplete display issue ([#905](https://github.com/sassoftware/vscode-sas-extension/issues/905))
- Result panels are empty on VS Code restart ([#937](https://github.com/sassoftware/vscode-sas-extension/issues/937))
- using pretty for json output to avoid long line ([#938](https://github.com/sassoftware/vscode-sas-extension/pull/938))
- Password Character Parsing for SAS 9.4 Remote IOM Connection ([#939](https://github.com/sassoftware/vscode-sas-extension/issues/939))

## [v1.8.0] - 2024-03-20

### Added

- Added SAS file entry to `New File...` menu ([#812](https://github.com/sassoftware/vscode-sas-extension/pull/812))
- SAS log colors for Local 94 and IOM ([#843](https://github.com/sassoftware/vscode-sas-extension/pull/843))
- Added better error reporting for COM/IOM connections ([#842](https://github.com/sassoftware/vscode-sas-extension/pull/842))

### Changed

- Update command palette entry `SAS: Sign in` so that it's only visible for Viya profiles. Non-viya users will still be able to connect and execute code by using the running man icon ([#862](https://github.com/sassoftware/vscode-sas-extension/pull/862))

### Fixed

- Formatting issue when lua submit block is empty ([#848](https://github.com/sassoftware/vscode-sas-extension/issues/848))
- Remote Unix machine x window issue ([#699](https://github.com/sassoftware/vscode-sas-extension/issues/699))
- PDF Download doesn't display content ([#838](https://github.com/sassoftware/vscode-sas-extension/issues/838))
- Prevent Viya connection from generating guid based html files ([#815](https://github.com/sassoftware/vscode-sas-extension/pull/815))

## [v1.7.1] - 2024-02-15

### Fixed

- Fixed an issue where users were not able to add new profiles if starting with no profiles ([#826](https://github.com/sassoftware/vscode-sas-extension/pull/826))

### Added

- Add Spanish translation ([#749](https://github.com/sassoftware/vscode-sas-extension/pull/749))

## [v1.7.0] - 2024-02-08

### Added

- Support formatting SAS code ([#681](https://github.com/sassoftware/vscode-sas-extension/pull/681))
- Added extra settings options to customize when SAS log is shown ([#713](https://github.com/sassoftware/vscode-sas-extension/pull/713))
- Improved function autocomplete ([#724](https://github.com/sassoftware/vscode-sas-extension/pull/724))

### Fixed

- Unexpected indentation when paste ([#735](https://github.com/sassoftware/vscode-sas-extension/issues/735))
- The "Close Session" menu is no longer available after saving any changes to the `settings.json` file ([#745](https://github.com/sassoftware/vscode-sas-extension/issues/745))
- Error message for connection error need to be externalized ([#734](https://github.com/sassoftware/vscode-sas-extension/issues/734))
- I18n node names when converting SAS Notebook to SAS Flow ([#530](https://github.com/sassoftware/vscode-sas-extension/issues/530))
- Ending inner block properly inside macro ([#772](https://github.com/sassoftware/vscode-sas-extension/issues/772))

## [v1.6.0] - 2024-01-15

### Added

- Added the ability to upload and download sas content using the context menu ([#547](https://github.com/sassoftware/vscode-sas-extension/issues/547))
- Added the ability to download results as an html file ([#546](https://github.com/sassoftware/vscode-sas-extension/issues/546))
- Added sas 9.4 remote connection support via ITC and the IOM Bridge protocol ([#592](https://github.com/sassoftware/vscode-sas-extension/pull/592))
- Support recursive folding block ([#555](https://github.com/sassoftware/vscode-sas-extension/pull/555))
- Added `Close Session` button on the tooltip of the active profile status bar item ([#573](https://github.com/sassoftware/vscode-sas-extension/pull/573))
- Support function signature help ([#626](https://github.com/sassoftware/vscode-sas-extension/pull/626))
- Added `ods graphics on;` to the wrapper code ([#648](https://github.com/sassoftware/vscode-sas-extension/pull/648))
- Japanese translation ([#597](https://github.com/sassoftware/vscode-sas-extension/pull/597))
- French translation ([#634](https://github.com/sassoftware/vscode-sas-extension/pull/634))
- Italian translation ([#654](https://github.com/sassoftware/vscode-sas-extension/pull/654))

### Changed

- Required VS Code version 1.82 at minimum
- Removed the disconnect button from the editor toolbar (next to the run button), Please use the `Close Session` button on the tooltip of the active profile status bar item instead. ([#573](https://github.com/sassoftware/vscode-sas-extension/pull/573))

### Fixed

- ODS display image inline ([#471](https://github.com/sassoftware/vscode-sas-extension/issues/471))
- sasnb extension name for save ([#607](https://github.com/sassoftware/vscode-sas-extension/issues/607))
- document symbol error ([#715](https://github.com/sassoftware/vscode-sas-extension/issues/715))

## [v1.5.0] - 2023-10-27

### Added

- Allow dragging sas content into editor ([#510](https://github.com/sassoftware/vscode-sas-extension/pull/510))
- Added the ability to use `Convert to flow...` for sas notebooks in the local filesystem ([#552](https://github.com/sassoftware/vscode-sas-extension/pull/552))
- Add Portuguese (Brazil) translation ([#529](https://github.com/sassoftware/vscode-sas-extension/pull/529))
- Add Korean translation ([#566](https://github.com/sassoftware/vscode-sas-extension/pull/566))
- Assign `_SASPROGRAMFILE` macro-variable to path of submitted SAS notebook code ([#551](https://github.com/sassoftware/vscode-sas-extension/pull/551))

### Fixed

- Target display issue for local profile ([#514](https://github.com/sassoftware/vscode-sas-extension/issues/514))
- Check for failed state during session log stream to prevent unbounded loop ([#562](https://github.com/sassoftware/vscode-sas-extension/issues/562))

## [v1.4.1] - 2023-09-29

### Fixed

- Use sas-notebook renderer only for .sasnb files ([#538](https://github.com/sassoftware/vscode-sas-extension/pull/538))

## [v1.4.0] - 2023-09-28

### Added

- Run SAS code via VS Code tasks ([#444](https://github.com/sassoftware/vscode-sas-extension/pull/444))
- Convert `.sasnb` to `.flw` ([#447](https://github.com/sassoftware/vscode-sas-extension/pull/447))
- Refined SAS code auto-indentation ([#451](https://github.com/sassoftware/vscode-sas-extension/pull/451))
- Option to control the default placement of Result panel ([#513](https://github.com/sassoftware/vscode-sas-extension/pull/513))
- Assign `_SASPROGRAMFILE` macro-variable to full path and filename of submitted SAS program ([#524](https://github.com/sassoftware/vscode-sas-extension/pull/524))

### Fixed

- Content rename issues ([#445](https://github.com/sassoftware/vscode-sas-extension/issues/445))([#504](https://github.com/sassoftware/vscode-sas-extension/issues/504))([#507](https://github.com/sassoftware/vscode-sas-extension/issues/507))([#533](https://github.com/sassoftware/vscode-sas-extension/issues/533))
- Call routine autocomplete ([#497](https://github.com/sassoftware/vscode-sas-extension/issues/497))
- Update high contrast data viewer theming ([#448](https://github.com/sassoftware/vscode-sas-extension/issues/448))

## [v1.3.0] - 2023-09-12

### Added

- Option to specify ODS style (match VS Code color theme by default) ([#473](https://github.com/sassoftware/vscode-sas-extension/pull/473))
- German translation ([#466](https://github.com/sassoftware/vscode-sas-extension/pull/466))
- (Engineering) Locale script to ease translating extension into different languages. See `CONTRIBUTING.md` for more information. ([#464](https://github.com/sassoftware/vscode-sas-extension/pull/464))

### Changed

- Setting ID `SAS.session.outputHtml` changed to `SAS.results.html.enabled` ([#496](https://github.com/sassoftware/vscode-sas-extension/pull/496))

### Fixed

- Always show running man icon ([#433](https://github.com/sassoftware/vscode-sas-extension/issues/433))
- SSH connection error ([#458](https://github.com/sassoftware/vscode-sas-extension/issues/458))
- Show results even job is in error state ([#468](https://github.com/sassoftware/vscode-sas-extension/pull/468))
- Escape $ symbol for local connection ([#356](https://github.com/sassoftware/vscode-sas-extension/issues/356))
- Notebook hangs with local connection ([#472](https://github.com/sassoftware/vscode-sas-extension/issues/472))
- Previous log shown for SSH connection ([#470](https://github.com/sassoftware/vscode-sas-extension/issues/470))
- Result displaying issue for SSH connection ([#483](https://github.com/sassoftware/vscode-sas-extension/issues/483))

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
