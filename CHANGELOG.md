<a name="unreleased"></a>
## [Unreleased]
 

<a name="v1.20.0"></a>
## [v1.20.0] - 2026-06-29
### Added
- updating package.json to also support R and SQL as editorLangIds ([#1845](https://github.com/sassoftware/vscode-sas-extension/issues/1845))
- R syntax highlighting and Notebook Support ([#1719](https://github.com/sassoftware/vscode-sas-extension/issues/1719))
- add the ability to pin columns ([#1781](https://github.com/sassoftware/vscode-sas-extension/issues/1781))

### Fixed
- set `baseDirectory` when executing notebook cells ([#1895](https://github.com/sassoftware/vscode-sas-extension/issues/1895))
- date formatting for SAS dates in TablePropertiesViewer ([#1872](https://github.com/sassoftware/vscode-sas-extension/issues/1872))
- two line gaps gets added on double formatting sas program ([#1892](https://github.com/sassoftware/vscode-sas-extension/issues/1892))
- add information to column query for IOM connections

### Chore
- add changelog configs ([#1915](https://github.com/sassoftware/vscode-sas-extension/issues/1915))
- add developer documentation ([#1914](https://github.com/sassoftware/vscode-sas-extension/issues/1914))
- add translations for 1.20.0 ([#1909](https://github.com/sassoftware/vscode-sas-extension/issues/1909))
- update webviews to retain context when hidden ([#1800](https://github.com/sassoftware/vscode-sas-extension/issues/1800))
- change dependabot frequency ([#1881](https://github.com/sassoftware/vscode-sas-extension/issues/1881))

### Docs
- update contributor agreement


<a name="v1.19.1"></a>
## [v1.19.1] - 2026-04-01
### Fixed
- fix execution policy issues with ITC connections ([#1844](https://github.com/sassoftware/vscode-sas-extension/issues/1844))

### Chore
- macro keyword parameter semantic token ([#1837](https://github.com/sassoftware/vscode-sas-extension/issues/1837))


<a name="v1.19.0"></a>
## [v1.19.0] - 2026-03-27
### Added
- Allow running Python code files in SAS Content  ([#1815](https://github.com/sassoftware/vscode-sas-extension/issues/1815))
- add filter for data viewer ([#1757](https://github.com/sassoftware/vscode-sas-extension/issues/1757))
- add keyboard accessibility / tooltips for table header ([#1743](https://github.com/sassoftware/vscode-sas-extension/issues/1743))

### Fixed
- only deploy docs for current tag ([#1809](https://github.com/sassoftware/vscode-sas-extension/issues/1809))
- revert table filter documentation ([#1805](https://github.com/sassoftware/vscode-sas-extension/issues/1805))
- sasprogramfile macro ([#1419](https://github.com/sassoftware/vscode-sas-extension/issues/1419)) ([#1774](https://github.com/sassoftware/vscode-sas-extension/issues/1774))
- fix misc selection issues ([#1748](https://github.com/sassoftware/vscode-sas-extension/issues/1748))
- correctly render katex symbols on html export ([#1734](https://github.com/sassoftware/vscode-sas-extension/issues/1734))
- Fix missing code from merge
- Add _SASPROGRAMDIR variable ([#1264](https://github.com/sassoftware/vscode-sas-extension/issues/1264))
- delete multiple tables from lib pane ([#1705](https://github.com/sassoftware/vscode-sas-extension/issues/1705))

### Chore
- add ag grid technical details ([#1838](https://github.com/sassoftware/vscode-sas-extension/issues/1838))
- update table filter docs ([#1806](https://github.com/sassoftware/vscode-sas-extension/issues/1806))
- clarify sas options footnote ([#1816](https://github.com/sassoftware/vscode-sas-extension/issues/1816))
- update issue templates ([#1808](https://github.com/sassoftware/vscode-sas-extension/issues/1808))
- add translations for 1.19.0 ([#1792](https://github.com/sassoftware/vscode-sas-extension/issues/1792))
- updating pubsdata to use latest SAS doc version ([#1770](https://github.com/sassoftware/vscode-sas-extension/issues/1770))
- update syntax data 2025.12 ([#1756](https://github.com/sassoftware/vscode-sas-extension/issues/1756))
- move itc script to ps1 file ([#1747](https://github.com/sassoftware/vscode-sas-extension/issues/1747))
-  update table viewer / table properties docs ([#1721](https://github.com/sassoftware/vscode-sas-extension/issues/1721))


<a name="v1.18.0"></a>
## [v1.18.0] - 2025-12-01
### Added
- implement column sorting ([#1622](https://github.com/sassoftware/vscode-sas-extension/issues/1622))
- **LanguageServiceProvider:** added code comment collapsing ([#1638](https://github.com/sassoftware/vscode-sas-extension/issues/1638))
- **LibraryNavigator:** added ability to view dataset properties ([#1631](https://github.com/sassoftware/vscode-sas-extension/issues/1631))

### Fixed
- fix light/dark theme toggling ([#1701](https://github.com/sassoftware/vscode-sas-extension/issues/1701))
- fix vsix builder ([#1706](https://github.com/sassoftware/vscode-sas-extension/issues/1706))
- fix test failure ([#1699](https://github.com/sassoftware/vscode-sas-extension/issues/1699))
- **ContentNavigator:** added name checking for duplicates on drag and drop ([#1665](https://github.com/sassoftware/vscode-sas-extension/issues/1665))

### Chore
- add translations for 1.18.0 ([#1700](https://github.com/sassoftware/vscode-sas-extension/issues/1700))
- add vsix build script ([#1703](https://github.com/sassoftware/vscode-sas-extension/issues/1703))
- only copy files once during build ([#1682](https://github.com/sassoftware/vscode-sas-extension/issues/1682))
- update pull_request_template.md ([#1639](https://github.com/sassoftware/vscode-sas-extension/issues/1639))


<a name="v1.17.0"></a>
## [v1.17.0] - 2025-09-26
### Added
- allow mapping VS Code color theme to custom ODS style ([#1619](https://github.com/sassoftware/vscode-sas-extension/issues/1619))

### Fixed
- fix multiple establish connection calls ([#1624](https://github.com/sassoftware/vscode-sas-extension/issues/1624))
- enable filter library name in SET statement ([#1609](https://github.com/sassoftware/vscode-sas-extension/issues/1609))
- fix build process ([#1594](https://github.com/sassoftware/vscode-sas-extension/issues/1594))
- update environment manager screenshot ([#1593](https://github.com/sassoftware/vscode-sas-extension/issues/1593))
- first empty line condition for toggleLineComment ([#1584](https://github.com/sassoftware/vscode-sas-extension/issues/1584))

### Chore
- add translations for 1.17.0 ([#1645](https://github.com/sassoftware/vscode-sas-extension/issues/1645))
- update syntax data 2025.09 ([#1646](https://github.com/sassoftware/vscode-sas-extension/issues/1646))
- update glob dependency ([#1596](https://github.com/sassoftware/vscode-sas-extension/issues/1596))
- remove nock dependency ([#1595](https://github.com/sassoftware/vscode-sas-extension/issues/1595))


<a name="v1.16.0"></a>
## [v1.16.0] - 2025-07-31
### Added
- add support for file navigation root ([#1557](https://github.com/sassoftware/vscode-sas-extension/issues/1557))
- set default CSV save location to workspace root for remote workspace  ([#1550](https://github.com/sassoftware/vscode-sas-extension/issues/1550))
- be able to ignore region from format ([#1534](https://github.com/sassoftware/vscode-sas-extension/issues/1534))
- toggle SAS code comments by line ([#1521](https://github.com/sassoftware/vscode-sas-extension/issues/1521))

### Fixed
- toggle line comment in PROC PYTHON ([#1571](https://github.com/sassoftware/vscode-sas-extension/issues/1571))
- autocomplete for sub-options ([#1556](https://github.com/sassoftware/vscode-sas-extension/issues/1556))
- remove redundant line break at end ([#1523](https://github.com/sassoftware/vscode-sas-extension/issues/1523))
- Library Viewer optimization in ITC ([#1520](https://github.com/sassoftware/vscode-sas-extension/issues/1520))
- adjust end folding line ([#1513](https://github.com/sassoftware/vscode-sas-extension/issues/1513))

### Chore
- update syntax data 2025.07 ([#1561](https://github.com/sassoftware/vscode-sas-extension/issues/1561))
- update syntax data 2025.06 ([#1535](https://github.com/sassoftware/vscode-sas-extension/issues/1535))


<a name="v1.15.0"></a>
## [v1.15.0] - 2025-06-10
### Added
- implement sas file system for IOM/COM connections ([#1388](https://github.com/sassoftware/vscode-sas-extension/issues/1388))

### Fixed
- Table Viewer optimization in ITC ([#1466](https://github.com/sassoftware/vscode-sas-extension/issues/1466))
- be able to fold all regions ([#1494](https://github.com/sassoftware/vscode-sas-extension/issues/1494))
- correct default value for last found index in ProblemProcessor ([#1475](https://github.com/sassoftware/vscode-sas-extension/issues/1475)) ([#1484](https://github.com/sassoftware/vscode-sas-extension/issues/1484))
- locate problems correctly when there are %INC statements ([#1347](https://github.com/sassoftware/vscode-sas-extension/issues/1347)) ([#1448](https://github.com/sassoftware/vscode-sas-extension/issues/1448))

### Chore
- update dependencies ([#1509](https://github.com/sassoftware/vscode-sas-extension/issues/1509))
- add Traditional Chinese and Polish translations ([#1457](https://github.com/sassoftware/vscode-sas-extension/issues/1457))
- update syntax data 2025.05 ([#1483](https://github.com/sassoftware/vscode-sas-extension/issues/1483))


<a name="v1.14.0"></a>
## [v1.14.0] - 2025-04-28
### Added
- provide getLibraries and getColumns API for Rest ([#1450](https://github.com/sassoftware/vscode-sas-extension/issues/1450))
- load interop dlls for iom/com, supply appname ([#1409](https://github.com/sassoftware/vscode-sas-extension/issues/1409))
- export sasnb to HTML ([#1417](https://github.com/sassoftware/vscode-sas-extension/issues/1417))

### Fixed
- reduce unnecessary rest calls ([#1452](https://github.com/sassoftware/vscode-sas-extension/issues/1452))

### Chore
- add translations for 1.14.0 ([#1453](https://github.com/sassoftware/vscode-sas-extension/issues/1453))
- update syntax data 2025.03 ([#1431](https://github.com/sassoftware/vscode-sas-extension/issues/1431))
- restore getFoldingBlock LSP API ([#1429](https://github.com/sassoftware/vscode-sas-extension/issues/1429))


<a name="v1.13.1"></a>
## [v1.13.1] - 2025-03-04
### Fixed
- reject run promise when close session ([#1390](https://github.com/sassoftware/vscode-sas-extension/issues/1390))
- bubble server error up ([#1389](https://github.com/sassoftware/vscode-sas-extension/issues/1389))
- proc python auto-indent ([#1377](https://github.com/sassoftware/vscode-sas-extension/issues/1377))
- remove unexpected endsubmit autocomplete ([#1359](https://github.com/sassoftware/vscode-sas-extension/issues/1359))
- log color issue ([#1346](https://github.com/sassoftware/vscode-sas-extension/issues/1346))

### Chore
- update syntax data 2025.02 ([#1410](https://github.com/sassoftware/vscode-sas-extension/issues/1410))
- update issue templates ([#1397](https://github.com/sassoftware/vscode-sas-extension/issues/1397))
- add it translations ([#1314](https://github.com/sassoftware/vscode-sas-extension/issues/1314))


<a name="v1.13.0"></a>
## [v1.13.0] - 2024-12-22
### Added
- display macro name in outline ([#1326](https://github.com/sassoftware/vscode-sas-extension/issues/1326))
- inherit VS Code file icons in SAS Content and Server ([#1310](https://github.com/sassoftware/vscode-sas-extension/issues/1310))
- python language features ([#991](https://github.com/sassoftware/vscode-sas-extension/issues/991))

### Fixed
- adopt AG Grid 33 ([#1335](https://github.com/sassoftware/vscode-sas-extension/issues/1335))
- language server exception for PROC PYTHON ([#1322](https://github.com/sassoftware/vscode-sas-extension/issues/1322))
- use vscode.open to open file ([#1297](https://github.com/sassoftware/vscode-sas-extension/issues/1297))
- support SAS module help in PROC PYTHON ([#1305](https://github.com/sassoftware/vscode-sas-extension/issues/1305))
- sas log code action should not impact others ([#1308](https://github.com/sassoftware/vscode-sas-extension/issues/1308))
- display context in hover help for data step statement option ([#1307](https://github.com/sassoftware/vscode-sas-extension/issues/1307))
- do not add empty line before the first section inside a region ([#1298](https://github.com/sassoftware/vscode-sas-extension/issues/1298))
- display global option help in data step ([#1296](https://github.com/sassoftware/vscode-sas-extension/issues/1296))

### Chore
- use new jsx transform ([#1278](https://github.com/sassoftware/vscode-sas-extension/issues/1278))


<a name="v1.12.0"></a>
## [v1.12.0] - 2024-11-25
### Added
- implement sas file system for viya connections ([#1203](https://github.com/sassoftware/vscode-sas-extension/issues/1203))
- enable find in result pane ([#714](https://github.com/sassoftware/vscode-sas-extension/issues/714))
- username and password support for SSH connection type ([#1126](https://github.com/sassoftware/vscode-sas-extension/issues/1126))

### Fixed
- don't show help when hover on white space ([#1279](https://github.com/sassoftware/vscode-sas-extension/issues/1279))
- reset work dir parser each time ([#1269](https://github.com/sassoftware/vscode-sas-extension/issues/1269))
- should not clear log for non-user running ([#1244](https://github.com/sassoftware/vscode-sas-extension/issues/1244))
- allow bracket matching in macro quote ([#1252](https://github.com/sassoftware/vscode-sas-extension/issues/1252))
- formatting should allow statements between proc python and submit ([#1227](https://github.com/sassoftware/vscode-sas-extension/issues/1227))

### Chore
- update syntax data 2024.11 ([#1286](https://github.com/sassoftware/vscode-sas-extension/issues/1286))
- add translations for 1.12.0 ([#1281](https://github.com/sassoftware/vscode-sas-extension/issues/1281))


<a name="v1.11.0"></a>
## [v1.11.0] - 2024-10-09
### Added
- clear log on execution start ([#1168](https://github.com/sassoftware/vscode-sas-extension/issues/1168))
- export sas notebook to sas file ([#1157](https://github.com/sassoftware/vscode-sas-extension/issues/1157))
- make content models connection agnostic ([#1079](https://github.com/sassoftware/vscode-sas-extension/issues/1079))

### Fixed
- get filename rather than Uri ([#1224](https://github.com/sassoftware/vscode-sas-extension/issues/1224))
- formatting fedsql code lost issue ([#1205](https://github.com/sassoftware/vscode-sas-extension/issues/1205))
- exception with empty user code ([#1204](https://github.com/sassoftware/vscode-sas-extension/issues/1204))
- trim prompt line in ssh ([#1190](https://github.com/sassoftware/vscode-sas-extension/issues/1190))
- remove hardcoded memsize system option ([#1188](https://github.com/sassoftware/vscode-sas-extension/issues/1188))
- run selected text with run task ([#1186](https://github.com/sassoftware/vscode-sas-extension/issues/1186))

### Chore
- add translations for 1.11.0 ([#1232](https://github.com/sassoftware/vscode-sas-extension/issues/1232))


<a name="v1.10.2"></a>
## [v1.10.2] - 2024-08-30
### Fixed
- get working directory via IOM API ([#1163](https://github.com/sassoftware/vscode-sas-extension/issues/1163))
- workaround compute log display issues ([#1151](https://github.com/sassoftware/vscode-sas-extension/issues/1151))
- build issue ([#1152](https://github.com/sassoftware/vscode-sas-extension/issues/1152))
- clear cell output before cell executing ([#1127](https://github.com/sassoftware/vscode-sas-extension/issues/1127))
- match latest ag grid template ([#1115](https://github.com/sassoftware/vscode-sas-extension/issues/1115))
- queue run code ([#1118](https://github.com/sassoftware/vscode-sas-extension/issues/1118))
- proc python formatting without endsubmit ([#1124](https://github.com/sassoftware/vscode-sas-extension/issues/1124))

### Chore
- update syntax data 2024.08 ([#1162](https://github.com/sassoftware/vscode-sas-extension/issues/1162))


<a name="v1.10.1"></a>
## [v1.10.1] - 2024-07-22
### Fixed
- library pane crash with option symbolgen ([#1098](https://github.com/sassoftware/vscode-sas-extension/issues/1098))
- Resolve the breaking change introduced by AG Grid 32.0 ([#1097](https://github.com/sassoftware/vscode-sas-extension/issues/1097))
- revise logic of _getIndentIncrementOfNextLine function ([#1084](https://github.com/sassoftware/vscode-sas-extension/issues/1084))
- output log in running tasks ([#1060](https://github.com/sassoftware/vscode-sas-extension/issues/1060))
- prevent decrease indentation when the word run is used as value ([#1039](https://github.com/sassoftware/vscode-sas-extension/issues/1039))

### Chore
- update syntax data 2024.06 ([#1061](https://github.com/sassoftware/vscode-sas-extension/issues/1061))


<a name="v1.10.0"></a>
## [v1.10.0] - 2024-06-18
### Added
- parse error/warning into problems panel ([#159](https://github.com/sassoftware/vscode-sas-extension/issues/159)) ([#627](https://github.com/sassoftware/vscode-sas-extension/issues/627))

### Fixed
- update code to detect if two code lines are same ([#1019](https://github.com/sassoftware/vscode-sas-extension/issues/1019)) ([#1020](https://github.com/sassoftware/vscode-sas-extension/issues/1020))
- fix content type when saving files ([#980](https://github.com/sassoftware/vscode-sas-extension/issues/980))
- problems are not clear when there is no problem in log ([#1018](https://github.com/sassoftware/vscode-sas-extension/issues/1018))
- support cshell for ssh ([#1007](https://github.com/sassoftware/vscode-sas-extension/issues/1007))
- IOM connection hang when work dir is long ([#978](https://github.com/sassoftware/vscode-sas-extension/issues/978))
- syntax help issue in special case ([#962](https://github.com/sassoftware/vscode-sas-extension/issues/962))
- Fileref OUTFILE should be allowed for COM/IOM ([#965](https://github.com/sassoftware/vscode-sas-extension/issues/965))

### Chore
- add translations for 1.10.0 ([#1021](https://github.com/sassoftware/vscode-sas-extension/issues/1021))
- update syntax data ([#1011](https://github.com/sassoftware/vscode-sas-extension/issues/1011))
- update syntax data 2024.05 ([#1010](https://github.com/sassoftware/vscode-sas-extension/issues/1010))


<a name="v1.9.0"></a>
## [v1.9.0] - 2024-04-30
### Added
- SQL/Python/Lua syntax highlight ([#813](https://github.com/sassoftware/vscode-sas-extension/issues/813))
- add libraries & tables for IOM/COM ([#880](https://github.com/sassoftware/vscode-sas-extension/issues/880))

### Fixed
- rehydrate result panels on restarts ([#935](https://github.com/sassoftware/vscode-sas-extension/issues/935))
- using pretty for json output to avoid long line ([#938](https://github.com/sassoftware/vscode-sas-extension/issues/938))
- fix password parsing ([#941](https://github.com/sassoftware/vscode-sas-extension/issues/941))
- create sas content files with proper content-type ([#914](https://github.com/sassoftware/vscode-sas-extension/issues/914))
- display function autocomplete at some special cases ([#906](https://github.com/sassoftware/vscode-sas-extension/issues/906))
- trim trailing line separator for SAS log ([#887](https://github.com/sassoftware/vscode-sas-extension/issues/887))
- **core:** ods html5 output path to work directory ([#664](https://github.com/sassoftware/vscode-sas-extension/issues/664))

### Chore
- add translations for 1.9.0 ([#940](https://github.com/sassoftware/vscode-sas-extension/issues/940))
- update syntax data ([#956](https://github.com/sassoftware/vscode-sas-extension/issues/956))


<a name="v1.8.0"></a>
## [v1.8.0] - 2024-03-20
### Added
- add better error reporting for COM/IOM connections ([#842](https://github.com/sassoftware/vscode-sas-extension/issues/842))
- SAS log colors for Local 94 and IOM ([#843](https://github.com/sassoftware/vscode-sas-extension/issues/843))
- add new sas file to New File... (resolves [#811](https://github.com/sassoftware/vscode-sas-extension/issues/811)) ([#812](https://github.com/sassoftware/vscode-sas-extension/issues/812))

### Fixed
- remove sign in from command palette ([#862](https://github.com/sassoftware/vscode-sas-extension/issues/862))
- remote unix machine x window issue when running specific sas code ([#699](https://github.com/sassoftware/vscode-sas-extension/issues/699)) ([#845](https://github.com/sassoftware/vscode-sas-extension/issues/845))
- formatting issue when lua submit block is empty ([#849](https://github.com/sassoftware/vscode-sas-extension/issues/849))
- prevent viya from generating guid based html files ([#815](https://github.com/sassoftware/vscode-sas-extension/issues/815))

### Chore
- add translations for 1.8.0 ([#888](https://github.com/sassoftware/vscode-sas-extension/issues/888))


<a name="v1.7.1"></a>
## [v1.7.1] - 2024-02-16
### Added
- Spanish translations ([#749](https://github.com/sassoftware/vscode-sas-extension/issues/749))

### Fixed
- add activeProfile check when creating library model ([#826](https://github.com/sassoftware/vscode-sas-extension/issues/826))


<a name="v1.7.0"></a>
## [v1.7.0] - 2024-02-07
### Added
- support formatting SAS code ([#681](https://github.com/sassoftware/vscode-sas-extension/issues/681))
- improve function autocomplete ([#724](https://github.com/sassoftware/vscode-sas-extension/issues/724))

### Fixed
- end inner block properly inside macro ([#795](https://github.com/sassoftware/vscode-sas-extension/issues/795))
- i18n enhancement of converting sas notebook to sas flow ([#530](https://github.com/sassoftware/vscode-sas-extension/issues/530)) ([#787](https://github.com/sassoftware/vscode-sas-extension/issues/787))
- pin node version to avoid compatibility issues
- externalized error message and toggle developer tools ([#734](https://github.com/sassoftware/vscode-sas-extension/issues/734)) ([#782](https://github.com/sassoftware/vscode-sas-extension/issues/782))
- close session when profile changed ([#761](https://github.com/sassoftware/vscode-sas-extension/issues/761))
- add formatonpaste configuration ([#746](https://github.com/sassoftware/vscode-sas-extension/issues/746))

### Chore
- update pt-br locale for 1.7.0 release ([#814](https://github.com/sassoftware/vscode-sas-extension/issues/814))
- update locales for 1.7.0 release ([#793](https://github.com/sassoftware/vscode-sas-extension/issues/793))
- update syntax data 2024.01 ([#794](https://github.com/sassoftware/vscode-sas-extension/issues/794))
- create library adapter, make library model api agnostic ([#733](https://github.com/sassoftware/vscode-sas-extension/issues/733))


<a name="v1.6.0"></a>
## [v1.6.0] - 2024-01-15
### Added
- add sas 9 remote (via IOM bridge) support ([#592](https://github.com/sassoftware/vscode-sas-extension/issues/592))
- recursive Folding Block ([#555](https://github.com/sassoftware/vscode-sas-extension/issues/555))
- ods graphics on; in wrapper ([#648](https://github.com/sassoftware/vscode-sas-extension/issues/648))
- support function signature help ([#626](https://github.com/sassoftware/vscode-sas-extension/issues/626))
- close session on status bar ([#573](https://github.com/sassoftware/vscode-sas-extension/issues/573))
- add csv import/export for translation tool ([#633](https://github.com/sassoftware/vscode-sas-extension/issues/633))
- update translations ([#584](https://github.com/sassoftware/vscode-sas-extension/issues/584))
- add ja ([#597](https://github.com/sassoftware/vscode-sas-extension/issues/597))
- add upload/download for sas content ([#550](https://github.com/sassoftware/vscode-sas-extension/issues/550))

### Fixed
- document symbol requires non-empty name ([#716](https://github.com/sassoftware/vscode-sas-extension/issues/716))
- sasnb extension name ([#614](https://github.com/sassoftware/vscode-sas-extension/issues/614))
- ODS display image inline ([#604](https://github.com/sassoftware/vscode-sas-extension/issues/604))

### Chore
- update syntax data 2023.12 ([#717](https://github.com/sassoftware/vscode-sas-extension/issues/717))
- update translations for pt-br locale ([#663](https://github.com/sassoftware/vscode-sas-extension/issues/663))
- update translations for ko locale ([#662](https://github.com/sassoftware/vscode-sas-extension/issues/662))
- update locale tool to support absolute paths ([#677](https://github.com/sassoftware/vscode-sas-extension/issues/677))
- update translations for fr locale ([#658](https://github.com/sassoftware/vscode-sas-extension/issues/658))
- update translations for de locale ([#657](https://github.com/sassoftware/vscode-sas-extension/issues/657))
- update translations for zh-cn locale ([#659](https://github.com/sassoftware/vscode-sas-extension/issues/659))
- update translations for it locale ([#660](https://github.com/sassoftware/vscode-sas-extension/issues/660))
- update translations for ja locale ([#661](https://github.com/sassoftware/vscode-sas-extension/issues/661))
- dependabot for /client /server and github-actions ([#615](https://github.com/sassoftware/vscode-sas-extension/issues/615))


<a name="v1.5.0"></a>
## [v1.5.0] - 2023-10-27
### Added
- allow convert to flow for explorer files ([#552](https://github.com/sassoftware/vscode-sas-extension/issues/552))
- allow dragging sas content into editor ([#510](https://github.com/sassoftware/vscode-sas-extension/issues/510))
- add ko locale ([#565](https://github.com/sassoftware/vscode-sas-extension/issues/565)) ([#566](https://github.com/sassoftware/vscode-sas-extension/issues/566))
- add pt-br locale/update de terms ([#529](https://github.com/sassoftware/vscode-sas-extension/issues/529))

### Fixed
- check for failed state during session log stream to prevent unbounded loop ([#564](https://github.com/sassoftware/vscode-sas-extension/issues/564))
- display target for local profile ([#515](https://github.com/sassoftware/vscode-sas-extension/issues/515))

### Chore
- update syntax data
- store built vsix ([#575](https://github.com/sassoftware/vscode-sas-extension/issues/575))
- reorganize utils ([#554](https://github.com/sassoftware/vscode-sas-extension/issues/554))


<a name="v1.4.1"></a>
## [v1.4.1] - 2023-09-28
### Fixed
- associate sas-notebook with sasnb only ([#538](https://github.com/sassoftware/vscode-sas-extension/issues/538))

### Chore
- release doc ([#539](https://github.com/sassoftware/vscode-sas-extension/issues/539))


<a name="v1.4.0"></a>
## [v1.4.0] - 2023-09-28
### Added
- convert .sasnb to .flw ([#447](https://github.com/sassoftware/vscode-sas-extension/issues/447))
- option to control the default placement of Result panel ([#513](https://github.com/sassoftware/vscode-sas-extension/issues/513))
- sort imports ([#511](https://github.com/sassoftware/vscode-sas-extension/issues/511))
- run SAS code via vscode tasks ([#444](https://github.com/sassoftware/vscode-sas-extension/issues/444))
- refined indentation parsed programmatically ([#451](https://github.com/sassoftware/vscode-sas-extension/issues/451))

### Fixed
- rename folder failed ([#533](https://github.com/sassoftware/vscode-sas-extension/issues/533))
- do not rename when cancel input ([#504](https://github.com/sassoftware/vscode-sas-extension/issues/504))
- add proper content-type for rename ([#507](https://github.com/sassoftware/vscode-sas-extension/issues/507))
- call routine autocomplete ([#509](https://github.com/sassoftware/vscode-sas-extension/issues/509))
- correctly re-open files for content rename ([#487](https://github.com/sassoftware/vscode-sas-extension/issues/487))

### Chore
- update syntax data ([#535](https://github.com/sassoftware/vscode-sas-extension/issues/535))


<a name="v1.3.0"></a>
## [v1.3.0] - 2023-09-11
### Added
- change output html option to more logical/consistent ID and re-order options ([#496](https://github.com/sassoftware/vscode-sas-extension/issues/496))
- improve translation check ([#495](https://github.com/sassoftware/vscode-sas-extension/issues/495))
- provide an easy way for users to specify the ods style of the results and automatically use a style that reasonably matches the vs code theme by default ([#473](https://github.com/sassoftware/vscode-sas-extension/issues/473))
- add locale script ([#464](https://github.com/sassoftware/vscode-sas-extension/issues/464))
- add German language support ([#466](https://github.com/sassoftware/vscode-sas-extension/issues/466))

### Fixed
- should not trim HTML buffer ([#484](https://github.com/sassoftware/vscode-sas-extension/issues/484))
- escape $ symbol in powershell code for local connection ([#474](https://github.com/sassoftware/vscode-sas-extension/issues/474))
- notebook run complete on com ([#475](https://github.com/sassoftware/vscode-sas-extension/issues/475))
- do not show previous log for ssh ([#476](https://github.com/sassoftware/vscode-sas-extension/issues/476))
- check job results for success or error ([#468](https://github.com/sassoftware/vscode-sas-extension/issues/468))
- ssh setup resolve ([#465](https://github.com/sassoftware/vscode-sas-extension/issues/465))
- always show running man icon ([#435](https://github.com/sassoftware/vscode-sas-extension/issues/435))

### Chore
- update syntax data ([#502](https://github.com/sassoftware/vscode-sas-extension/issues/502))
- update lockfile-version to 3 ([#486](https://github.com/sassoftware/vscode-sas-extension/issues/486))
- ability to debug single test file ([#469](https://github.com/sassoftware/vscode-sas-extension/issues/469))


<a name="v1.2.0"></a>
## [v1.2.0] - 2023-08-10
### Added
- case of autocompletion item is following user's typing case. ([#430](https://github.com/sassoftware/vscode-sas-extension/issues/430))

### Fixed
- fix column header icons ([#443](https://github.com/sassoftware/vscode-sas-extension/issues/443))

### Chore
- minor cleanup ([#436](https://github.com/sassoftware/vscode-sas-extension/issues/436))


<a name="v1.1.0"></a>
## [v1.1.0] - 2023-08-03
### Added
- use ag grid for table display ([#395](https://github.com/sassoftware/vscode-sas-extension/issues/395))
- Simplified Chinese translation ([#409](https://github.com/sassoftware/vscode-sas-extension/issues/409))
- l10n infrastructure ([#370](https://github.com/sassoftware/vscode-sas-extension/issues/370))
- autoexec support for viya connection ([#355](https://github.com/sassoftware/vscode-sas-extension/issues/355))
- SAS Options support for rest connection profiles ([#339](https://github.com/sassoftware/vscode-sas-extension/issues/339))

### Fixed
- able to show content on 2023.03 ([#328](https://github.com/sassoftware/vscode-sas-extension/issues/328)) ([#422](https://github.com/sassoftware/vscode-sas-extension/issues/422))
- close notebook before delete ([#419](https://github.com/sassoftware/vscode-sas-extension/issues/419))
- correct the links to get all log ([#421](https://github.com/sassoftware/vscode-sas-extension/issues/421))
- should not show cancel button if not supported ([#406](https://github.com/sassoftware/vscode-sas-extension/issues/406))
- regex to match html5 file name in local COM ([#381](https://github.com/sassoftware/vscode-sas-extension/issues/381))
- fix dependency mismatch ([#400](https://github.com/sassoftware/vscode-sas-extension/issues/400))
- check that _onLogFn exists before calling in printSessionLog ([#378](https://github.com/sassoftware/vscode-sas-extension/issues/378))
- ability to cancel profile update ([#392](https://github.com/sassoftware/vscode-sas-extension/issues/392))
- get all pages of results ([#357](https://github.com/sassoftware/vscode-sas-extension/issues/357))
- correct autoexec config name ([#372](https://github.com/sassoftware/vscode-sas-extension/issues/372))
- replace equals with space for compute options ([#359](https://github.com/sassoftware/vscode-sas-extension/issues/359))
- fix copyright check script ([#344](https://github.com/sassoftware/vscode-sas-extension/issues/344))

### Chore
- update syntax data ([#429](https://github.com/sassoftware/vscode-sas-extension/issues/429))


<a name="v1.0.0"></a>
## [v1.0.0] - 2023-06-16
### Added
- Change license to official Apache 2.0 license ([#341](https://github.com/sassoftware/vscode-sas-extension/issues/341))
- SAS Local Execution ([#146](https://github.com/sassoftware/vscode-sas-extension/issues/146))
- add drag/drop for sas content ([#268](https://github.com/sassoftware/vscode-sas-extension/issues/268))
- support cancelling running job ([#321](https://github.com/sassoftware/vscode-sas-extension/issues/321))
- support notebook ([#234](https://github.com/sassoftware/vscode-sas-extension/issues/234))

### Fixed
- readme link
- do not connect content when not supported ([#318](https://github.com/sassoftware/vscode-sas-extension/issues/318))
- library summary accept header ([#311](https://github.com/sassoftware/vscode-sas-extension/issues/311))
- several library requests need accept header ([#301](https://github.com/sassoftware/vscode-sas-extension/issues/301))

### Chore
- update syntax data ([#342](https://github.com/sassoftware/vscode-sas-extension/issues/342))


<a name="v0.1.5"></a>
## [v0.1.5] - 2023-05-19
### Added
- implement react data viewer w/ infinite scrolling ([#199](https://github.com/sassoftware/vscode-sas-extension/issues/199))
- run region ([#223](https://github.com/sassoftware/vscode-sas-extension/issues/223))
- support user provided CA certificates ([#221](https://github.com/sassoftware/vscode-sas-extension/issues/221))

### Fixed
- Add back library support for direct SAS connections.
- error when run code ([#296](https://github.com/sassoftware/vscode-sas-extension/issues/296))
- remove trailing slash when get profile ([#277](https://github.com/sassoftware/vscode-sas-extension/issues/277))
- be able to dragging table into sas program
- library model has to reset session id on profile change
- let builtin suggestion popup ([#261](https://github.com/sassoftware/vscode-sas-extension/issues/261))
- authentication provider should fire proper event ([#236](https://github.com/sassoftware/vscode-sas-extension/issues/236))

### Chore
- update syntax data ([#298](https://github.com/sassoftware/vscode-sas-extension/issues/298))


<a name="v0.1.4"></a>
## [v0.1.4] - 2023-04-28
### Added
- Reconnect to existing SAS Session if possible.

### Fixed
- fix content ordering ([#246](https://github.com/sassoftware/vscode-sas-extension/issues/246))
- remove extra bracket from table view ([#263](https://github.com/sassoftware/vscode-sas-extension/issues/263))
- correct content order ([#225](https://github.com/sassoftware/vscode-sas-extension/issues/225)) ([#226](https://github.com/sassoftware/vscode-sas-extension/issues/226))
- fix trailing slash on viya profile endpoints ([#232](https://github.com/sassoftware/vscode-sas-extension/issues/232))

### Chore
- update changelog ([#247](https://github.com/sassoftware/vscode-sas-extension/issues/247))
- update vsce ([#233](https://github.com/sassoftware/vscode-sas-extension/issues/233))


<a name="v0.1.3"></a>
## [v0.1.3] - 2023-04-13
### Added
- add sas library support ([#143](https://github.com/sassoftware/vscode-sas-extension/issues/143))
- support recycle bin in content navigation [#152](https://github.com/sassoftware/vscode-sas-extension/issues/152) ([#190](https://github.com/sassoftware/vscode-sas-extension/issues/190))
- ssh agent auth ([#202](https://github.com/sassoftware/vscode-sas-extension/issues/202))
- SAS 9.4 Remote Support via SSH ([#134](https://github.com/sassoftware/vscode-sas-extension/issues/134))
- add SAS content pane ([#57](https://github.com/sassoftware/vscode-sas-extension/issues/57))
- support authorization redirect ([#110](https://github.com/sassoftware/vscode-sas-extension/issues/110))

### Fixed
- keep re-auth issue ([#228](https://github.com/sassoftware/vscode-sas-extension/issues/228))
- address various auth issues ([#217](https://github.com/sassoftware/vscode-sas-extension/issues/217))
- fix miscellaneous bugs for 0.1.3 deployment ([#211](https://github.com/sassoftware/vscode-sas-extension/issues/211))
- remove foreach when iterating with promise ([#188](https://github.com/sassoftware/vscode-sas-extension/issues/188))
- reset ready timeout on successful connection ([#160](https://github.com/sassoftware/vscode-sas-extension/issues/160))
- improve the new file/folder name validator ([#156](https://github.com/sassoftware/vscode-sas-extension/issues/156)) ([#162](https://github.com/sassoftware/vscode-sas-extension/issues/162))
- reconnect to sas content on 401 error ([#171](https://github.com/sassoftware/vscode-sas-extension/issues/171))
- double quote glob patterns when linting ([#150](https://github.com/sassoftware/vscode-sas-extension/issues/150))
- run all mocha tests ([#148](https://github.com/sassoftware/vscode-sas-extension/issues/148))

### Chore
- update syntax data ([#212](https://github.com/sassoftware/vscode-sas-extension/issues/212))
- update changelog ([#208](https://github.com/sassoftware/vscode-sas-extension/issues/208))


<a name="v0.1.2"></a>
## [v0.1.2] - 2023-02-01
### Added
- Implemented SAS Log Streaming ([#39](https://github.com/sassoftware/vscode-sas-extension/issues/39)).

### Fixed
- recognize nls character in dataset name ([#106](https://github.com/sassoftware/vscode-sas-extension/issues/106))
- recognize macro ending without semicolon ([#89](https://github.com/sassoftware/vscode-sas-extension/issues/89))
- Only show Results window if result is generated [#46](https://github.com/sassoftware/vscode-sas-extension/issues/46).
- Results window becomes active after code runs ([#37](https://github.com/sassoftware/vscode-sas-extension/issues/37))
- copy vscode setting object ([#43](https://github.com/sassoftware/vscode-sas-extension/issues/43)) ([#44](https://github.com/sassoftware/vscode-sas-extension/issues/44))

### Chore
- update syntax data
- update pull request template  ([#58](https://github.com/sassoftware/vscode-sas-extension/issues/58))
- update changelog ([#55](https://github.com/sassoftware/vscode-sas-extension/issues/55))
- add no-unused-vars rule ([#59](https://github.com/sassoftware/vscode-sas-extension/issues/59))
- require brackets for conditional statements ([#49](https://github.com/sassoftware/vscode-sas-extension/issues/49))
- add pull request template ([#54](https://github.com/sassoftware/vscode-sas-extension/issues/54))
- make prettier the default formatter ([#52](https://github.com/sassoftware/vscode-sas-extension/issues/52))
- add .gitattributes/tweak changelog ([#41](https://github.com/sassoftware/vscode-sas-extension/issues/41))
- update README


<a name="v0.1.1"></a>
## [v0.1.1] - 2022-11-24
### Added
- login with saslogon ([#35](https://github.com/sassoftware/vscode-sas-extension/issues/35))
- support dataset autocomplete in lsp server

### Fixed
- hide run button while running SAS code ([#34](https://github.com/sassoftware/vscode-sas-extension/issues/34))
- SQL snippet syntax

### Chore
- update syntax data


<a name="v0.1.0"></a>
## [v0.1.0] - 2022-10-08
### Fixed
- percentage sign should escape quotes
- SQL snippet syntax
- improve macro handling
- recognize % as word

### Chore
- update syntax data
- bump restaf version


<a name="v0.0.7"></a>
## [v0.0.7] - 2022-07-27
### Added
- support run selected sas code ([#21](https://github.com/sassoftware/vscode-sas-extension/issues/21))

### Chore
- prettier ignore vscode-test
- add format task


<a name="v0.0.6"></a>
## [v0.0.6] - 2022-07-08
### Added
- support i18n on LSP server

### Fixed
- recover syntax check mode before each run
- inherit default color theme

### Chore
- update syntax data


<a name="v0.0.5"></a>
## [v0.0.5] - 2022-05-25
### Fixed
- compute context not found error added compute context config

### Chore
- update syntax data
- update dependencies


<a name="v0.0.4"></a>
## v0.0.4 - 2022-05-19
### Fixed
- blank error in some cases doc: update README.md to link to wiki, add CHANGELOG.md


[Unreleased]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.20.0...HEAD
[v1.20.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.19.1...v1.20.0
[v1.19.1]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.19.0...v1.19.1
[v1.19.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.18.0...v1.19.0
[v1.18.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.17.0...v1.18.0
[v1.17.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.16.0...v1.17.0
[v1.16.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.15.0...v1.16.0
[v1.15.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.14.0...v1.15.0
[v1.14.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.13.1...v1.14.0
[v1.13.1]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.13.0...v1.13.1
[v1.13.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.12.0...v1.13.0
[v1.12.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.11.0...v1.12.0
[v1.11.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.10.2...v1.11.0
[v1.10.2]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.10.1...v1.10.2
[v1.10.1]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.10.0...v1.10.1
[v1.10.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.9.0...v1.10.0
[v1.9.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.8.0...v1.9.0
[v1.8.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.7.1...v1.8.0
[v1.7.1]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.7.0...v1.7.1
[v1.7.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.6.0...v1.7.0
[v1.6.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.5.0...v1.6.0
[v1.5.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.4.1...v1.5.0
[v1.4.1]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.4.0...v1.4.1
[v1.4.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.3.0...v1.4.0
[v1.3.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.2.0...v1.3.0
[v1.2.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.1.0...v1.2.0
[v1.1.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v1.0.0...v1.1.0
[v1.0.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v0.1.5...v1.0.0
[v0.1.5]: https://github.com/sassoftware/vscode-sas-extension/compare/v0.1.4...v0.1.5
[v0.1.4]: https://github.com/sassoftware/vscode-sas-extension/compare/v0.1.3...v0.1.4
[v0.1.3]: https://github.com/sassoftware/vscode-sas-extension/compare/v0.1.2...v0.1.3
[v0.1.2]: https://github.com/sassoftware/vscode-sas-extension/compare/v0.1.1...v0.1.2
[v0.1.1]: https://github.com/sassoftware/vscode-sas-extension/compare/v0.1.0...v0.1.1
[v0.1.0]: https://github.com/sassoftware/vscode-sas-extension/compare/v0.0.7...v0.1.0
[v0.0.7]: https://github.com/sassoftware/vscode-sas-extension/compare/v0.0.6...v0.0.7
[v0.0.6]: https://github.com/sassoftware/vscode-sas-extension/compare/v0.0.5...v0.0.6
[v0.0.5]: https://github.com/sassoftware/vscode-sas-extension/compare/v0.0.4...v0.0.5
