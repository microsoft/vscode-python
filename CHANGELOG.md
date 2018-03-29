# Changelog

## 2018.3.1 (29 Mar 2018)

### Fixes

1. Fixes issue that causes linter to fail when file path contains spaces.
([#1239](https://github.com/Microsoft/vscode-python/issues/1239))

## 2018.3.0 (28 Mar 2018)

### Enhancements

1. Add a PySpark debug configuration for the experimental debugger.
 ([#1029](https://github.com/Microsoft/vscode-python/issues/1029))
1. Add a Pyramid debug configuration for the experimental debugger.
 ([#1030](https://github.com/Microsoft/vscode-python/issues/1030))
1. Add a Watson debug configuration for the experimental debugger.
 ([#1031](https://github.com/Microsoft/vscode-python/issues/1031))
1. Add a Scrapy debug configuration for the experimental debugger.
 ([#1032](https://github.com/Microsoft/vscode-python/issues/1032))
1. When using pipenv, install packages (such as linters, test frameworks) in dev-packages.
 ([#1110](https://github.com/Microsoft/vscode-python/issues/1110))
1. Added commands translation for italian locale.
(thanks [Dotpys](https://github.com/Dotpys/)) ([#1152](https://github.com/Microsoft/vscode-python/issues/1152))
1. Add support for Django Template debugging in experimental debugger.
 ([#1189](https://github.com/Microsoft/vscode-python/issues/1189))
1. Add support for Flask Template debugging in experimental debugger.
 ([#1190](https://github.com/Microsoft/vscode-python/issues/1190))
1. Add support for Jinja template debugging. ([#1210](https://github.com/Microsoft/vscode-python/issues/1210))
1. When debugging, use `Integrated Terminal` as the default console.
 ([#526](https://github.com/Microsoft/vscode-python/issues/526))
1. Disable the display of errors messages when rediscovering of tests fail in response to changes to files, e.g. don't show a message if there's a syntax error in the test code.
 ([#704](https://github.com/Microsoft/vscode-python/issues/704))
1. Bundle python depedencies (PTVSD package) in the extension for the experimental debugger.
 ([#741](https://github.com/Microsoft/vscode-python/issues/741))
1. Add support for expermental debugger when debugging Python Unit Tests.
 ([#906](https://github.com/Microsoft/vscode-python/issues/906))
1. Support `Debug Console` as a `console` option for the Experimental Debugger.
 ([#950](https://github.com/Microsoft/vscode-python/issues/950))
1. Enable syntax highlighting for `requirements.in` files as used by
e.g. [pip-tools](https://github.com/jazzband/pip-tools)
(thanks [Lorenzo Villani](https://github.com/lvillani))
 ([#961](https://github.com/Microsoft/vscode-python/issues/961))
1. Add support to read name of Pipfile from environment variable.
 ([#999](https://github.com/Microsoft/vscode-python/issues/999))

### Fixes

1. Fixes issue that causes debugging of unit tests to hang indefinitely. ([#1009](https://github.com/Microsoft/vscode-python/issues/1009))
1. Add ability to disable the check on memory usage of language server (Jedi) process.
To turn off this check, add `"python.jediMemoryLimit": -1` to your user or workspace settings (`settings.json`) file.
 ([#1036](https://github.com/Microsoft/vscode-python/issues/1036))
1. Ignore test results when debugging unit tests.
 ([#1043](https://github.com/Microsoft/vscode-python/issues/1043))
1. Fixes auto formatting of conditional statements containing expressions with `<=` symbols.
 ([#1096](https://github.com/Microsoft/vscode-python/issues/1096))
1. Resolve debug configuration information in `launch.json` when debugging without opening a python file.
 ([#1098](https://github.com/Microsoft/vscode-python/issues/1098))
1. Disables auto completion when editing text at the end of a comment string.
 ([#1123](https://github.com/Microsoft/vscode-python/issues/1123))
1. Ensures file paths are properly encoded when passing them as arguments to linters.
 ([#199](https://github.com/Microsoft/vscode-python/issues/199))
1. Fix occasionally having unverified breakpoints
 ([#87](https://github.com/Microsoft/vscode-python/issues/87))
1. Ensure conda installer is not used for non-conda environments.
 ([#969](https://github.com/Microsoft/vscode-python/issues/969))
1. Fixes issue that display incorrect interpreter briefly before updating it to the right value.
 ([#981](https://github.com/Microsoft/vscode-python/issues/981))

### Code Health

1. Exclude 'news' folder from getting packaged into the extension.
 ([#1020](https://github.com/Microsoft/vscode-python/issues/1020))
1. Remove Jupyter commands.
(thanks [Yu Zhang](https://github.com/neilsustc))
 ([#1034](https://github.com/Microsoft/vscode-python/issues/1034))
1. Trigger incremental build compilation only when typescript files are modified.
 ([#1040](https://github.com/Microsoft/vscode-python/issues/1040))
1. Updated npm dependencies in devDependencies and fix TypeScript compilation issues.
 ([#1042](https://github.com/Microsoft/vscode-python/issues/1042))
1. Enable unit testing of stdout and stderr redirection for the experimental debugger.
 ([#1048](https://github.com/Microsoft/vscode-python/issues/1048))
1. Update npm package `vscode-extension-telemetry` to fix the warning 'os.tmpDir() deprecation'.
(thanks [osya](https://github.com/osya))
 ([#1066](https://github.com/Microsoft/vscode-python/issues/1066))
1. Prevent the debugger stepping into JS code while developing the extension when debugging async TypeScript code.
 ([#1090](https://github.com/Microsoft/vscode-python/issues/1090))
1. Increase timeouts for the debugger unit tests.
 ([#1094](https://github.com/Microsoft/vscode-python/issues/1094))
1. Change the command used to install pip on AppVeyor to avoid installation errors.
 ([#1107](https://github.com/Microsoft/vscode-python/issues/1107))
1. Check whether a document is active when detecthing changes in the active document.
 ([#1114](https://github.com/Microsoft/vscode-python/issues/1114))
1. Remove SIGINT handler in debugger adapter, thereby preventing it from shutting down the debugger.
 ([#1122](https://github.com/Microsoft/vscode-python/issues/1122))
1. Improve compilation speed of the extension's TypeScript code.
 ([#1146](https://github.com/Microsoft/vscode-python/issues/1146))
1. Changes to how debug options are passed into the experimental version of PTVSD (debugger).
 ([#1168](https://github.com/Microsoft/vscode-python/issues/1168))
1. Ensure file paths are not sent in telemetry when running unit tests.
 ([#1180](https://github.com/Microsoft/vscode-python/issues/1180))
1. Change `DjangoDebugging` to `Django` in `debugOptions` of launch.json.
 ([#1198](https://github.com/Microsoft/vscode-python/issues/1198))
1. Changed property name used to capture the trigger source of Unit Tests. ([#1213](https://github.com/Microsoft/vscode-python/issues/1213))
1. Enable unit testing of the experimental debugger on CI servers
 ([#742](https://github.com/Microsoft/vscode-python/issues/742))
1. Generate code coverage for debug adapter unit tests.
 ([#778](https://github.com/Microsoft/vscode-python/issues/778))
1. Execute prospector as a module (using -m).
 ([#982](https://github.com/Microsoft/vscode-python/issues/982))
1. Launch unit tests in debug mode as opposed to running and attaching the debugger to the already-running interpreter.
 ([#983](https://github.com/Microsoft/vscode-python/issues/983))

## 2018.2.1 (09 Mar 2018)

### Fixes

1. Check for `Pipfile` and not `pipfile` when looking for pipenv usage
   (thanks to [Will Thompson for the fix](https://github.com/wjt))

## 2018.2.0 (08 Mar 2018)

[Release pushed by one week]

### Thanks

We appreciate everyone who contributed to this release (including
those who reported bugs or provided feedback)!

A special thanks goes out to the following external contributors who
contributed code in this release:

* [Andrea D'Amore](https://github.com/Microsoft/vscode-python/commits?author=anddam)
* [Tzu-ping Chung](https://github.com/Microsoft/vscode-python/commits?author=uranusjr)
* [Elliott Beach](https://github.com/Microsoft/vscode-python/commits?author=elliott-beach)
* [Manuja Jay](https://github.com/Microsoft/vscode-python/commits?author=manujadev)
* [philipwasserman](https://github.com/Microsoft/vscode-python/commits?author=philipwasserman)

### Enhancements

1. Experimental support for PTVSD 4.0.0-alpha (too many issues to list)
1. Speed increases in interpreter selection ([#952](https://github.com/Microsoft/vscode-python/issues/952))
1. Support for [direnv](https://direnv.net/)
   ([#36](https://github.com/Microsoft/vscode-python/issues/36))
1. Support for pipenv virtual environments; do note that using pipenv
   automatically drops all other interpreters from the list of
   possible interpreters as pipenv prefers to "own" your virtual
   environment
   ([#404](https://github.com/Microsoft/vscode-python/issues/404))
1. Support for pyenv installs of Python
   ([#847](https://github.com/Microsoft/vscode-python/issues/847))
1. Support `editor.formatOnType` ([#640](https://github.com/Microsoft/vscode-python/issues/640))
1. Added a `zh-tw` translation ([#](https://github.com/Microsoft/vscode-python/pull/841))
1. Prompting to install a linter now allows for disabling that specific
   linter as well as linters globally
   ([#971](https://github.com/Microsoft/vscode-python/issues/971))

### Fixes

1. Work around a bug in Pylint when the default linter rules are
   enabled and running Python 2.7 which triggered `--py3k` checks
   to be activated, e.g. all `print` statements to be flagged as
   errors
   ([#722](https://github.com/Microsoft/vscode-python/issues/722))
1. Better detection of when a virtual environment is selected, leading
   to the extension accurately leaving off `--user` when installing
   Pylint ([#808](https://github.com/Microsoft/vscode-python/issues/808))
1. Better detection of a `pylintrc` is available to automatically disable our
   default Pylint checks
   ([#728](https://github.com/Microsoft/vscode-python/issues/728),
    [#788](https://github.com/Microsoft/vscode-python/issues/788),
    [#838](https://github.com/Microsoft/vscode-python/issues/838),
    [#442](https://github.com/Microsoft/vscode-python/issues/442))
1. Fix `Got to Python object` ([#403](https://github.com/Microsoft/vscode-python/issues/403))
1. When reformatting a file, put the temporary file in the workspace
   folder so e.g. yapf detect their configuration files appropriately
   ([#730](https://github.com/Microsoft/vscode-python/issues/730))
1. The banner to suggest someone installs Python now says `Download`
   instead of `Close` ([#844](https://github.com/Microsoft/vscode-python/issues/844))
1. Formatting while typing now treats `.` and `@` as operators,
   preventing the incorrect insertion of whitespace
   ([#840](https://github.com/Microsoft/vscode-python/issues/840))
1. Debugging from a virtual environment named `env` now works
   ([#691](https://github.com/Microsoft/vscode-python/issues/691))
1. Disabling linting in a single folder of a mult-root workspace no
   longer disables it for all folders ([#862](https://github.com/Microsoft/vscode-python/issues/862))
1. Fix the default debugger settings for Flask apps
   ([#573](https://github.com/Microsoft/vscode-python/issues/573))
1. Format paths correctly when sending commands through WSL and git-bash;
   this does not lead to official support for either terminal
   ([#895](https://github.com/Microsoft/vscode-python/issues/895))
1. Prevent run-away Jedi processes from consuming too much memory by
   automatically killing the process; reload VS Code to start the
   process again if desired
   ([#926](https://github.com/Microsoft/vscode-python/issues/926),
    [#263](https://github.com/Microsoft/vscode-python/issues/263))
1. Support multiple linters again
   ([#913](https://github.com/Microsoft/vscode-python/issues/913))
1. Don't over-escape markup found in docstrings
   ([#911](https://github.com/Microsoft/vscode-python/issues/911),
    [#716](https://github.com/Microsoft/vscode-python/issues/716),
    [#627](https://github.com/Microsoft/vscode-python/issues/627),
    [#692](https://github.com/Microsoft/vscode-python/issues/692))
1. Fix when the `Problems` pane lists file paths prefixed with `git:`
   ([#916](https://github.com/Microsoft/vscode-python/issues/916))
1. Fix inline documentation when an odd number of quotes exists
   ([#786](https://github.com/Microsoft/vscode-python/issues/786))
1. Don't erroneously warn macOS users about using the system install
   of Python when a virtual environment is already selected
   ([#804](https://github.com/Microsoft/vscode-python/issues/804))
1. Fix activating multiple linters without requiring a reload of
   VS Code
   ([#971](https://github.com/Microsoft/vscode-python/issues/971))

### Code Health

1. Upgrade to Jedi 0.11.1
   ([#674](https://github.com/Microsoft/vscode-python/issues/674),
    [#607](https://github.com/Microsoft/vscode-python/issues/607),
    [#99](https://github.com/Microsoft/vscode-python/issues/99))
1. Removed the banner announcing the extension moving over to
   Microsoft ([#830](https://github.com/Microsoft/vscode-python/issues/830))
1. Renamed the default debugger configurations ([#412](https://github.com/Microsoft/vscode-python/issues/412))
1. Remove some error logging about not finding conda
   ([#864](https://github.com/Microsoft/vscode-python/issues/864))

## 2018.1.0 (01 Feb 2018)

### Thanks

Thanks to everyone who contributed to this release, including
the following people who contributed code:

* [jpfarias](https://github.com/jpfarias)
* [Hongbo He](https://github.com/graycarl)
* [JohnstonCode](https://github.com/JohnstonCode)
* [Yuichi Nukiyama](https://github.com/YuichiNukiyama)
* [MichaelSuen](https://github.com/MichaelSuen-thePointer)

### Fixed issues

* Support cached interpreter locations for faster interpreter selection ([#666](https://github.com/Microsoft/vscode-python/issues/259))
* Sending a block of code with multiple global-level scopes now works ([#259](https://github.com/Microsoft/vscode-python/issues/259))
* Automatic activation of virtual or conda environment in terminal when executing Python code/file ([#383](https://github.com/Microsoft/vscode-python/issues/383))
* Introduce a `Python: Create Terminal` to create a terminal that activates the selected virtual/conda environment ([#622](https://github.com/Microsoft/vscode-python/issues/622))
* Add a `ko-kr` translation ([#540](https://github.com/Microsoft/vscode-python/pull/540))
* Add a `ru` translation ([#411](https://github.com/Microsoft/vscode-python/pull/411))
* Performance improvements to detection of virtual environments in current workspace ([#372](https://github.com/Microsoft/vscode-python/issues/372))
* Correctly detect 64-bit python ([#414](https://github.com/Microsoft/vscode-python/issues/414))
* Display parameter information while typing ([#70](https://github.com/Microsoft/vscode-python/issues/70))
* Use `localhost` instead of `0.0.0.0` when starting debug servers ([#205](https://github.com/Microsoft/vscode-python/issues/205))
* Ability to configure host name of debug server ([#227](https://github.com/Microsoft/vscode-python/issues/227))
* Use environment variable PYTHONPATH defined in `.env` for intellisense and code navigation ([#316](https://github.com/Microsoft/vscode-python/issues/316))
* Support path variable when debugging ([#436](https://github.com/Microsoft/vscode-python/issues/436))
* Ensure virtual environments can be created in `.env` directory ([#435](https://github.com/Microsoft/vscode-python/issues/435), [#482](https://github.com/Microsoft/vscode-python/issues/482), [#486](https://github.com/Microsoft/vscode-python/issues/486))
* Reload environment variables from `.env` without having to restart VS Code ([#183](https://github.com/Microsoft/vscode-python/issues/183))
* Support debugging of Pyramid framework on Windows ([#519](https://github.com/Microsoft/vscode-python/issues/519))
* Code snippet for `pubd` ([#545](https://github.com/Microsoft/vscode-python/issues/545))
* Code clean up ([#353](https://github.com/Microsoft/vscode-python/issues/353), [#352](https://github.com/Microsoft/vscode-python/issues/352), [#354](https://github.com/Microsoft/vscode-python/issues/354), [#456](https://github.com/Microsoft/vscode-python/issues/456), [#491](https://github.com/Microsoft/vscode-python/issues/491), [#228](https://github.com/Microsoft/vscode-python/issues/228), [#549](https://github.com/Microsoft/vscode-python/issues/545), [#594](https://github.com/Microsoft/vscode-python/issues/594), [#617](https://github.com/Microsoft/vscode-python/issues/617), [#556](https://github.com/Microsoft/vscode-python/issues/556))
* Move to `yarn` from `npm` ([#421](https://github.com/Microsoft/vscode-python/issues/421))
* Add code coverage for extension itself ([#464](https://github.com/Microsoft/vscode-python/issues/464))
* Releasing [insiders build](https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix) of the extension and uploading to cloud storage ([#429](https://github.com/Microsoft/vscode-python/issues/429))
* Japanese translation ([#434](https://github.com/Microsoft/vscode-python/pull/434))
* Russian translation ([#411](https://github.com/Microsoft/vscode-python/pull/411))
* Support paths with spaces when generating tags with `Build Workspace Symbols` ([#44](https://github.com/Microsoft/vscode-python/issues/44))
* Add ability to configure the linters ([#572](https://github.com/Microsoft/vscode-python/issues/572))
* Add default set of rules for Pylint ([#554](https://github.com/Microsoft/vscode-python/issues/554))
* Prompt to install formatter if not available ([#524](https://github.com/Microsoft/vscode-python/issues/524))
* work around `editor.formatOnSave` failing when taking more then 750ms ([#124](https://github.com/Microsoft/vscode-python/issues/124), [#590](https://github.com/Microsoft/vscode-python/issues/590), [#624](https://github.com/Microsoft/vscode-python/issues/624), [#427](https://github.com/Microsoft/vscode-python/issues/427), [#492](https://github.com/Microsoft/vscode-python/issues/492))
* Function argument completion no longer automatically includes the default argument ([#522](https://github.com/Microsoft/vscode-python/issues/522))
* When sending a selection to the terminal, keep the focus in the editor window ([#60](https://github.com/Microsoft/vscode-python/issues/60))
* Install packages for non-environment Pythons as `--user` installs ([#527](https://github.com/Microsoft/vscode-python/issues/527))
* No longer suggest the system Python install on macOS when running `Select Interpreter` as it's too outdated (e.g. lacks `pip`) ([#440](https://github.com/Microsoft/vscode-python/issues/440))
* Fix potential hang from Intellisense ([#423](https://github.com/Microsoft/vscode-python/issues/423))

## Version 0.9.1 (19 December 2017)

* Fixes the compatibility issue with the [Visual Studio Code Tools for AI](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.vscode-ai) [#432](https://github.com/Microsoft/vscode-python/issues/432)
* Display runtime errors encountered when running a python program without debugging [#454](https://github.com/Microsoft/vscode-python/issues/454)

## Version 0.9.0 (14 December 2017)

* Translated the commands to simplified Chinese [#240](https://github.com/Microsoft/vscode-python/pull/240) (thanks [Wai Sui kei](https://github.com/WaiSiuKei))
* Change all links to point to their Python 3 equivalents instead of Python 2[#203](https://github.com/Microsoft/vscode-python/issues/203)
* Respect `{workspaceFolder}` [#258](https://github.com/Microsoft/vscode-python/issues/258)
* Running a program using Ctrl-F5 will work more than once [#25](https://github.com/Microsoft/vscode-python/issues/25)
* Removed the feedback service to rely on VS Code's own support (which fixed an issue of document reformatting failing) [#245](https://github.com/Microsoft/vscode-python/issues/245), [#303](https://github.com/Microsoft/vscode-python/issues/303), [#363](https://github.com/Microsoft/vscode-python/issues/365)
* Do not create empty '.vscode' directory [#253](https://github.com/Microsoft/vscode-python/issues/253), [#277](https://github.com/Microsoft/vscode-python/issues/277)
* Ensure python execution environment handles unicode characters [#393](https://github.com/Microsoft/vscode-python/issues/393)
* Remove Jupyter support in favour of the [Jupyter extension](https://marketplace.visualstudio.com/items?itemName=donjayamanne.jupyter) [#223](https://github.com/microsoft/vscode-python/issues/223)

### `conda`

* Support installing Pylint using conda or pip when an Anaconda installation of Python is selected as the active interpreter [#301](https://github.com/Microsoft/vscode-python/issues/301)
* Add JSON schema support for conda's meta.yaml [#281](https://github.com/Microsoft/vscode-python/issues/281)
* Add JSON schema support for conda's environment.yml  [#280](https://github.com/Microsoft/vscode-python/issues/280)
* Add JSON schema support for .condarc [#189](https://github.com/Microsoft/vscode-python/issues/280)
* Ensure company name 'Continuum Analytics' is replaced with 'Ananconda Inc' in the list of interpreters [#390](https://github.com/Microsoft/vscode-python/issues/390)
* Display the version of the interpreter instead of conda [#378](https://github.com/Microsoft/vscode-python/issues/378)
* Detect Anaconda on Linux even if it is not in the current path [#22](https://github.com/Microsoft/vscode-python/issues/22)

### Interpreter selection

* Fixes in the discovery and display of interpreters, including virtual environments [#56](https://github.com/Microsoft/vscode-python/issues/56)
* Retrieve the right value from the registry when determining the version of an interpreter on Windows [#389](https://github.com/Microsoft/vscode-python/issues/389)

### Intellisense

* Fetch intellisense details on-demand instead of for all possible completions [#152](https://github.com/Microsoft/vscode-python/issues/152)
* Disable auto completion in comments and strings [#110](https://github.com/Microsoft/vscode-python/issues/110), [#921](https://github.com/Microsoft/vscode-python/issues/921), [#34](https://github.com/Microsoft/vscode-python/issues/34)

### Linting

* Deprecate `python.linting.lintOnTextChange` [#313](https://github.com/Microsoft/vscode-python/issues/313), [#297](https://github.com/Microsoft/vscode-python/issues/297), [#28](https://github.com/Microsoft/vscode-python/issues/28), [#272](https://github.com/Microsoft/vscode-python/issues/272)
* Refactor code for executing linters (fixes running the proper linter under the selected interpreter) [#351](https://github.com/Microsoft/vscode-python/issues/351), [#397](https://github.com/Microsoft/vscode-python/issues/397)
* Don't attempt to install linters when not in a workspace [#42](https://github.com/Microsoft/vscode-python/issues/42)
* Honour `python.linting.enabled` [#26](https://github.com/Microsoft/vscode-python/issues/26)
* Don't display message 'Linter pylint is not installed' when changing settings [#260](https://github.com/Microsoft/vscode-python/issues/260)
* Display a meaningful message if pip is unavailable to install necessary module such as 'pylint' [#266](https://github.com/Microsoft/vscode-python/issues/266)
* Improvement environment variable parsing in the debugging (allows for embedded `=`) [#149](https://github.com/Microsoft/vscode-python/issues/149), [#361](https://github.com/Microsoft/vscode-python/issues/361)

### Debugging

* Improve selecting the port used when debugging [#304](https://github.com/Microsoft/vscode-python/pull/304)
* Don't block debugging in other extensions [#58](https://github.com/Microsoft/vscode-python/issues/58)
* Don't trigger an error to the Console Window when trying to debug an invalid Python file [#157](https://github.com/Microsoft/vscode-python/issues/157)
* No longer prompt to `Press any key to continue . . .` once debugging finishes [#239](https://github.com/Microsoft/vscode-python/issues/239)
* Do not start the extension when debugging non-Python projects [#57](https://github.com/Microsoft/vscode-python/issues/57)
* Support custom external terminals in debugger [#250](https://github.com/Microsoft/vscode-python/issues/250), [#114](https://github.com/Microsoft/vscode-python/issues/114)
* Debugging a python program should not display the message 'Cannot read property …' [#247](https://github.com/Microsoft/vscode-python/issues/247)

### Testing

* Refactor unit test library execution code [#350](https://github.com/Microsoft/vscode-python/issues/350)

### Formatting

* Deprecate the setting `python.formatting.formatOnSave` with an appropriate message [#285](https://github.com/Microsoft/vscode-python/issues/285), [#309](https://github.com/Microsoft/vscode-python/issues/309)

## Version 0.8.0 (9 November 2017)
* Add support for multi-root workspaces [#1228](https://github.com/DonJayamanne/pythonVSCode/issues/1228), [#1302](https://github.com/DonJayamanne/pythonVSCode/pull/1302), [#1328](https://github.com/DonJayamanne/pythonVSCode/issues/1328), [#1357](https://github.com/DonJayamanne/pythonVSCode/pull/1357)
* Add code snippet for ```ipdb``` [#1141](https://github.com/DonJayamanne/pythonVSCode/pull/1141)
* Add ability to resolving environment variables in path to ```mypy``` [#1195](https://github.com/DonJayamanne/pythonVSCode/issues/1195)
* Add ability to disable a linter globally and disable prompts to install linters [#1207](https://github.com/DonJayamanne/pythonVSCode/issues/1207)
* Auto-selecting an interpreter from a virtual environment if only one is found in the root directory of the project [#1216](https://github.com/DonJayamanne/pythonVSCode/issues/1216)
* Add support for specifying the working directory for unit tests [#1155](https://github.com/DonJayamanne/pythonVSCode/issues/1155), [#1185](https://github.com/DonJayamanne/pythonVSCode/issues/1185)
* Add syntax highlighting of pip requirements files [#1247](https://github.com/DonJayamanne/pythonVSCode/pull/1247)
* Add ability to select an interpreter even when a workspace is not open [#1260](https://github.com/DonJayamanne/pythonVSCode/issues/1260), [#1263](https://github.com/DonJayamanne/pythonVSCode/pull/1263)
* Display a code lens to change the selected interpreter to the one specified in the shebang line [#1257](https://github.com/DonJayamanne/pythonVSCode/pull/1257), [#1263](https://github.com/DonJayamanne/pythonVSCode/pull/1263), [#1267](https://github.com/DonJayamanne/pythonVSCode/pull/1267), [#1280](https://github.com/DonJayamanne/pythonVSCode/issues/1280), [#1261](https://github.com/DonJayamanne/pythonVSCode/issues/1261), [#1290](https://github.com/DonJayamanne/pythonVSCode/pull/1290)
* Expand list of interpreters displayed for selection [#1147](https://github.com/DonJayamanne/pythonVSCode/issues/1147),  [#1148](https://github.com/DonJayamanne/pythonVSCode/issues/1148), [#1224](https://github.com/DonJayamanne/pythonVSCode/pull/1224), [#1240](https://github.com/DonJayamanne/pythonVSCode/pull/1240)
* Display details of current or selected interpreter in statusbar [#1147](https://github.com/DonJayamanne/pythonVSCode/issues/1147), [#1217](https://github.com/DonJayamanne/pythonVSCode/issues/1217)
* Ensure paths in workspace symbols are not prefixed with ```.vscode``` [#816](https://github.com/DonJayamanne/pythonVSCode/issues/816), [#1066](https://github.com/DonJayamanne/pythonVSCode/pull/1066), [#829](https://github.com/DonJayamanne/pythonVSCode/issues/829)
* Ensure paths in ```PYTHONPATH``` environment variable are delimited using the OS-specific path delimiter [#832](https://github.com/DonJayamanne/pythonVSCode/issues/832)
* Ensure ```Rope``` is not packaged with the extension [#1208](https://github.com/DonJayamanne/pythonVSCode/issues/1208), [#1207](https://github.com/DonJayamanne/pythonVSCode/issues/1207), [#1243](https://github.com/DonJayamanne/pythonVSCode/pull/1243), [#1229](https://github.com/DonJayamanne/pythonVSCode/issues/1229)
* Ensure ctags are rebuilt as expected upon file save [#624](https://github.com/DonJayamanne/pythonVSCode/issues/1212)
* Ensure right test method is executed when two test methods exist with the same name in different classes [#1203](https://github.com/DonJayamanne/pythonVSCode/issues/1203)
* Ensure unit tests run successfully on Travis for both Python 2.7 and 3.6 [#1255](https://github.com/DonJayamanne/pythonVSCode/pull/1255), [#1241](https://github.com/DonJayamanne/pythonVSCode/issues/1241), [#1315](https://github.com/DonJayamanne/pythonVSCode/issues/1315)
* Fix building of ctags when a path contains a space [#1064](https://github.com/DonJayamanne/pythonVSCode/issues/1064), [#1144](https://github.com/DonJayamanne/pythonVSCode/issues/1144),, [#1213](https://github.com/DonJayamanne/pythonVSCode/pull/1213)
* Fix autocompletion in unsaved Python files [#1194](https://github.com/DonJayamanne/pythonVSCode/issues/1194)
* Fix running of test methods in nose [#597](https://github.com/DonJayamanne/pythonVSCode/issues/597), [#1225](https://github.com/DonJayamanne/pythonVSCode/pull/1225)
* Fix to disable linting of diff windows [#1221](https://github.com/DonJayamanne/pythonVSCode/issues/1221), [#1244](https://github.com/DonJayamanne/pythonVSCode/pull/1244)
* Fix docstring formatting [#1188](https://github.com/DonJayamanne/pythonVSCode/issues/1188)
* Fix to ensure language features can run in parallel without interference with one another [#1314](https://github.com/DonJayamanne/pythonVSCode/issues/1314), [#1318](https://github.com/DonJayamanne/pythonVSCode/pull/1318)
* Fix to ensure unit tests can be debugged more than once per run [#948](https://github.com/DonJayamanne/pythonVSCode/issues/948), [#1353](https://github.com/DonJayamanne/pythonVSCode/pull/1353)
* Fix to ensure parameterized unit tests can be debugged [#1284](https://github.com/DonJayamanne/pythonVSCode/issues/1284), [#1299](https://github.com/DonJayamanne/pythonVSCode/pull/1299)
* Fix issue that causes debugger to freeze/hang [#1041](https://github.com/DonJayamanne/pythonVSCode/issues/1041), [#1354](https://github.com/DonJayamanne/pythonVSCode/pull/1354)
* Fix to support unicode characters in Python tests [#1282](https://github.com/DonJayamanne/pythonVSCode/issues/1282), [#1291](https://github.com/DonJayamanne/pythonVSCode/pull/1291)
* Changes as a result of VS Code API changes [#1270](https://github.com/DonJayamanne/pythonVSCode/issues/1270), [#1288](https://github.com/DonJayamanne/pythonVSCode/pull/1288), [#1372](https://github.com/DonJayamanne/pythonVSCode/issues/1372), [#1300](https://github.com/DonJayamanne/pythonVSCode/pull/1300), [#1298](https://github.com/DonJayamanne/pythonVSCode/issues/1298)
* Updates to Readme [#1212](https://github.com/DonJayamanne/pythonVSCode/issues/1212), [#1222](https://github.com/DonJayamanne/pythonVSCode/issues/1222)
* Fix executing a command under PowerShell [#1098](https://github.com/DonJayamanne/pythonVSCode/issues/1098)


## Version 0.7.0 (3 August 2017)
* Displaying internal documentation [#1008](https://github.com/DonJayamanne/pythonVSCode/issues/1008), [#10860](https://github.com/DonJayamanne/pythonVSCode/issues/10860)
* Fixes to 'async with' snippet [#1108](https://github.com/DonJayamanne/pythonVSCode/pull/1108), [#996](https://github.com/DonJayamanne/pythonVSCode/issues/996)
* Add support for environment variable in unit tests [#1074](https://github.com/DonJayamanne/pythonVSCode/issues/1074)
* Fixes to unit test code lenses not being displayed [#1115](https://github.com/DonJayamanne/pythonVSCode/issues/1115)
* Fix to empty brackets being added [#1110](https://github.com/DonJayamanne/pythonVSCode/issues/1110), [#1031](https://github.com/DonJayamanne/pythonVSCode/issues/1031)
* Fix debugging of Django applications [#819](https://github.com/DonJayamanne/pythonVSCode/issues/819), [#999](https://github.com/DonJayamanne/pythonVSCode/issues/999)
* Update isort to the latest version [#1134](https://github.com/DonJayamanne/pythonVSCode/issues/1134), [#1135](https://github.com/DonJayamanne/pythonVSCode/pull/1135)
* Fix issue causing intellisense and similar functionality to stop working [#1072](https://github.com/DonJayamanne/pythonVSCode/issues/1072), [#1118](https://github.com/DonJayamanne/pythonVSCode/pull/1118), [#1089](https://github.com/DonJayamanne/pythonVSCode/issues/1089)
* Bunch of unit tests and code cleanup
* Resolve issue where navigation to decorated function goes to decorator [#742](https://github.com/DonJayamanne/pythonVSCode/issues/742)
* Go to symbol in workspace leads to nonexisting files [#816](https://github.com/DonJayamanne/pythonVSCode/issues/816), [#829](https://github.com/DonJayamanne/pythonVSCode/issues/829)

## Version 0.6.9 (22 July 2017)
* Fix to enure custom linter paths are respected [#1106](https://github.com/DonJayamanne/pythonVSCode/issues/1106)

## Version 0.6.8 (20 July 2017)
* Add new editor menu 'Run Current Unit Test File' [#1061](https://github.com/DonJayamanne/pythonVSCode/issues/1061)
* Changed 'mypy-lang' to mypy [#930](https://github.com/DonJayamanne/pythonVSCode/issues/930), [#998](https://github.com/DonJayamanne/pythonVSCode/issues/998), [#505](https://github.com/DonJayamanne/pythonVSCode/issues/505)
* Using "Python -m" to launch linters [#716](https://github.com/DonJayamanne/pythonVSCode/issues/716), [#923](https://github.com/DonJayamanne/pythonVSCode/issues/923), [#1059](https://github.com/DonJayamanne/pythonVSCode/issues/1059)
* Add PEP 526 AutoCompletion [#1102](https://github.com/DonJayamanne/pythonVSCode/pull/1102), [#1101](https://github.com/DonJayamanne/pythonVSCode/issues/1101)
* Resolved issues in Go To and Peek Definitions [#1085](https://github.com/DonJayamanne/pythonVSCode/pull/1085), [#961](https://github.com/DonJayamanne/pythonVSCode/issues/961), [#870](https://github.com/DonJayamanne/pythonVSCode/issues/870)

## Version 0.6.7 (02 July 2017)
* Updated icon from jpg to png (transparent background)

## Version 0.6.6 (02 July 2017)
* Provide details of error with solution for changes to syntax in launch.json [#1047](https://github.com/DonJayamanne/pythonVSCode/issues/1047), [#1025](https://github.com/DonJayamanne/pythonVSCode/issues/1025)
* Provide a warning about known issues with having pyenv.cfg whilst debugging [#913](https://github.com/DonJayamanne/pythonVSCode/issues/913)
* Create .vscode directory if not found [#1043](https://github.com/DonJayamanne/pythonVSCode/issues/1043)
* Highlighted text due to linter errors is off by one column [#965](https://github.com/DonJayamanne/pythonVSCode/issues/965), [#970](https://github.com/DonJayamanne/pythonVSCode/pull/970)
* Added preminary support for WSL Bash and Cygwin [#1049](https://github.com/DonJayamanne/pythonVSCode/pull/1049)
* Ability to configure the linter severity levels [#941](https://github.com/DonJayamanne/pythonVSCode/pull/941), [#895](https://github.com/DonJayamanne/pythonVSCode/issues/895)
* Fixes to unit tests [#1051](https://github.com/DonJayamanne/pythonVSCode/pull/1051), [#1050](https://github.com/DonJayamanne/pythonVSCode/pull/1050)
* Outdent lines following `contibue`, `break` and `return` [#1050](https://github.com/DonJayamanne/pythonVSCode/pull/1050)
* Change location of cache for Jedi files [#1035](https://github.com/DonJayamanne/pythonVSCode/pull/1035)
* Fixes to the way directories are searched for Python interpreters [#569](https://github.com/DonJayamanne/pythonVSCode/issues/569), [#1040](https://github.com/DonJayamanne/pythonVSCode/pull/1040)
* Handle outputs from Python packages that interfere with the way autocompletion is handled [#602](https://github.com/DonJayamanne/pythonVSCode/issues/602)

## Version 0.6.5 (13 June 2017)
* Fix error in launch.json [#1006](https://github.com/DonJayamanne/pythonVSCode/issues/1006)
* Detect current workspace interpreter when selecting interpreter [#1006](https://github.com/DonJayamanne/pythonVSCode/issues/979)
* Disable output buffering when debugging [#1005](https://github.com/DonJayamanne/pythonVSCode/issues/1005)
* Updated snippets to use correct placeholder syntax [#976](https://github.com/DonJayamanne/pythonVSCode/pull/976)
* Fix hover and auto complete unit tests [#1012](https://github.com/DonJayamanne/pythonVSCode/pull/1012)
* Fix hover definition variable test for Python 3.5 [#1013](https://github.com/DonJayamanne/pythonVSCode/pull/1013)
* Better formatting of docstring [#821](https://github.com/DonJayamanne/pythonVSCode/pull/821), [#919](https://github.com/DonJayamanne/pythonVSCode/pull/919)
* Supporting more paths when searching for Python interpreters [#569](https://github.com/DonJayamanne/pythonVSCode/issues/569)
* Increase buffer output (to support detection large number of tests) [#927](https://github.com/DonJayamanne/pythonVSCode/issues/927)

## Version 0.6.4 (4 May 2017)
* Fix dates in changelog [#899](https://github.com/DonJayamanne/pythonVSCode/pull/899)
* Using charriage return or line feeds to split a document into multiple lines [#917](https://github.com/DonJayamanne/pythonVSCode/pull/917), [#821](https://github.com/DonJayamanne/pythonVSCode/issues/821)
* Doc string not being displayed [#888](https://github.com/DonJayamanne/pythonVSCode/issues/888)
* Supporting paths that begin with the ~/ [#909](https://github.com/DonJayamanne/pythonVSCode/issues/909)
* Supporting more paths when searching for Python interpreters [#569](https://github.com/DonJayamanne/pythonVSCode/issues/569)
* Supporting ~/ paths when providing the path to ctag file [#910](https://github.com/DonJayamanne/pythonVSCode/issues/910)
* Disable linting of python files opened in diff viewer [#896](https://github.com/DonJayamanne/pythonVSCode/issues/896)
* Added a new command ```Go to Python Object``` [#928](https://github.com/DonJayamanne/pythonVSCode/issues/928)
* Restored the menu item to rediscover tests [#863](https://github.com/DonJayamanne/pythonVSCode/issues/863)
* Changes to rediscover tests when test files are altered and saved [#863](https://github.com/DonJayamanne/pythonVSCode/issues/863)

## Version 0.6.3 (19 April 2017)
* Fix debugger issue [#893](https://github.com/DonJayamanne/pythonVSCode/issues/893)
* Improvements to debugging unit tests (check if string starts with, instead of comparing equality) [#797](https://github.com/DonJayamanne/pythonVSCode/issues/797)

## Version 0.6.2 (13 April 2017)
* Fix incorrect indenting [#880](https://github.com/DonJayamanne/pythonVSCode/issues/880)

### Thanks
* [Yuwei Ba](https://github.com/ibigbug)

## Version 0.6.1 (10 April 2017)
* Add support for new variable syntax in upcoming VS Code release [#774](https://github.com/DonJayamanne/pythonVSCode/issues/774), [#855](https://github.com/DonJayamanne/pythonVSCode/issues/855), [#873](https://github.com/DonJayamanne/pythonVSCode/issues/873), [#823](https://github.com/DonJayamanne/pythonVSCode/issues/823)
* Resolve issues in code refactoring [#802](https://github.com/DonJayamanne/pythonVSCode/issues/802), [#824](https://github.com/DonJayamanne/pythonVSCode/issues/824), [#825](https://github.com/DonJayamanne/pythonVSCode/pull/825)
* Changes to labels in Python Interpreter lookup [#815](https://github.com/DonJayamanne/pythonVSCode/pull/815)
* Resolve Typos [#852](https://github.com/DonJayamanne/pythonVSCode/issues/852)
* Use fully qualitified Python Path when installing dependencies [#866](https://github.com/DonJayamanne/pythonVSCode/issues/866)
* Commands for running tests from a file [#502](https://github.com/DonJayamanne/pythonVSCode/pull/502)
* Fix Sorting of imports when path contains spaces [#811](https://github.com/DonJayamanne/pythonVSCode/issues/811)
* Fixing occasional failure of linters [#793](https://github.com/DonJayamanne/pythonVSCode/issues/793), [#833](https://github.com/DonJayamanne/pythonVSCode/issues/838), [#860](https://github.com/DonJayamanne/pythonVSCode/issues/860)
* Added ability to pre-load some modules to improve autocompletion [#581](https://github.com/DonJayamanne/pythonVSCode/issues/581)

### Thanks
* [Ashwin Mathews](https://github.com/ajmathews)
* [Alexander Ioannidis](https://github.com/slint)
* [Andreas Schlapsi](https://github.com/aschlapsi)

## Version 0.6.0 (10 March 2017)
* Moved Jupyter functionality into a separate extension [Jupyter]()
* Updated readme [#779](https://github.com/DonJayamanne/pythonVSCode/issues/779)
* Changing default arguments of ```mypy``` [#658](https://github.com/DonJayamanne/pythonVSCode/issues/658)
* Added ability to disable formatting [#559](https://github.com/DonJayamanne/pythonVSCode/issues/559)
* Fixing ability to run a Python file in a terminal [#784](https://github.com/DonJayamanne/pythonVSCode/issues/784)
* Added support for Proxy settings when installing Python packages using Pip [#778](https://github.com/DonJayamanne/pythonVSCode/issues/778)

## Version 0.5.9 (3 March 2017)
* Fixed navigating to definitions [#711](https://github.com/DonJayamanne/pythonVSCode/issues/711)
* Support auto detecting binaries from Python Path [#716](https://github.com/DonJayamanne/pythonVSCode/issues/716)
* Setting PYTHONPATH environment variable [#686](https://github.com/DonJayamanne/pythonVSCode/issues/686)
* Improving Linter performance, killing redundant processes [4a8319e](https://github.com/DonJayamanne/pythonVSCode/commit/4a8319e0859f2d49165c9a08fe147a647d03ece9)
* Changed default path of the CATAS file to `.vscode/tags` [#722](https://github.com/DonJayamanne/pythonVSCode/issues/722)
* Add parsing severity level for flake8 and pep8 linters [#709](https://github.com/DonJayamanne/pythonVSCode/pull/709)
* Fix to restore function descriptions (intellisense) [#727](https://github.com/DonJayamanne/pythonVSCode/issues/727)
* Added default configuration for debugging Pyramid [#287](https://github.com/DonJayamanne/pythonVSCode/pull/287)
* Feature request: Run current line in Terminal [#738](https://github.com/DonJayamanne/pythonVSCode/issues/738)
* Miscellaneous improvements to hover provider [6a7a3f3](https://github.com/DonJayamanne/pythonVSCode/commit/6a7a3f32ab8add830d13399fec6f0cdd14cd66fc), [6268306](https://github.com/DonJayamanne/pythonVSCode/commit/62683064d01cfc2b76d9be45587280798a96460b)
* Fixes to rename refactor (due to 'LF' EOL in Windows) [#748](https://github.com/DonJayamanne/pythonVSCode/pull/748)
* Fixes to ctag file being generated in home folder when no workspace is opened [#753](https://github.com/DonJayamanne/pythonVSCode/issues/753)
* Fixes to ctag file being generated in home folder when no workspace is opened [#753](https://github.com/DonJayamanne/pythonVSCode/issues/753)
* Disabling auto-completion in single line comments [#74](https://github.com/DonJayamanne/pythonVSCode/issues/74)
* Fixes to debugging of modules [#518](https://github.com/DonJayamanne/pythonVSCode/issues/518)
* Displaying unit test status icons against unit test code lenses [#678](https://github.com/DonJayamanne/pythonVSCode/issues/678)
* Fix issue where causing 'python.python-debug.startSession' not found message to be displayed when debugging single file [#708](https://github.com/DonJayamanne/pythonVSCode/issues/708)
* Ability to include packages directory when generating tags file [#735](https://github.com/DonJayamanne/pythonVSCode/issues/735)
* Fix issue where running selected text in terminal does not work [#758](https://github.com/DonJayamanne/pythonVSCode/issues/758)
* Fix issue where disabling linter doesn't disable it (when no workspace is open) [#763](https://github.com/DonJayamanne/pythonVSCode/issues/763)
* Search additional directories for Python Interpreters (~/.virtualenvs, ~/Envs, ~/.pyenv) [#569](https://github.com/DonJayamanne/pythonVSCode/issues/569)
* Added ability to pre-load some modules to improve autocompletion [#581](https://github.com/DonJayamanne/pythonVSCode/issues/581)
* Removed invalid default value in launch.json file [#586](https://github.com/DonJayamanne/pythonVSCode/issues/586)
* Added ability to configure the pylint executable path [#766](https://github.com/DonJayamanne/pythonVSCode/issues/766)
* Fixed single file debugger to ensure the Python interpreter configured in python.PythonPath is being used [#769](https://github.com/DonJayamanne/pythonVSCode/issues/769)

## Version 0.5.8 (3 February 2017)
* Fixed a bug in [debugging single files without a launch configuration](https://code.visualstudio.com/updates/v1_9#_debugging-without-a-launch-configuration) [#700](https://github.com/DonJayamanne/pythonVSCode/issues/700)
* Fixed error when starting REPL [#692](https://github.com/DonJayamanne/pythonVSCode/issues/692)

## Version 0.5.7 (3 February 2017)
* Added support for [debugging single files without a launch configuration](https://code.visualstudio.com/updates/v1_9#_debugging-without-a-launch-configuration)
* Adding support for debug snippets [#660](https://github.com/DonJayamanne/pythonVSCode/issues/660)
* Ability to run a selected text in a Django shell [#652](https://github.com/DonJayamanne/pythonVSCode/issues/652)
* Adding support for the use of a customized 'isort' for sorting of imports [#632](https://github.com/DonJayamanne/pythonVSCode/pull/632)
* Debuger auto-detecting python interpreter from the path provided [#688](https://github.com/DonJayamanne/pythonVSCode/issues/688)
* Showing symbol type on hover [#657](https://github.com/DonJayamanne/pythonVSCode/pull/657)
* Fixes to running Python file when terminal uses Powershell [#651](https://github.com/DonJayamanne/pythonVSCode/issues/651)
* Fixes to linter issues when displaying Git diff view for Python files [#665](https://github.com/DonJayamanne/pythonVSCode/issues/665)
* Fixes to 'Go to definition' functionality [#662](https://github.com/DonJayamanne/pythonVSCode/issues/662)
* Fixes to Jupyter cells numbered larger than '10' [#681](https://github.com/DonJayamanne/pythonVSCode/issues/681)

## Version 0.5.6 (16 January 2017)
* Added support for Python 3.6 [#646](https://github.com/DonJayamanne/pythonVSCode/issues/646), [#631](https://github.com/DonJayamanne/pythonVSCode/issues/631), [#619](https://github.com/DonJayamanne/pythonVSCode/issues/619), [#613](https://github.com/DonJayamanne/pythonVSCode/issues/613)
* Autodetect in python path in virtual environments [#353](https://github.com/DonJayamanne/pythonVSCode/issues/353)
* Add syntax highlighting of code samples in hover defintion [#555](https://github.com/DonJayamanne/pythonVSCode/issues/555)
* Launch REPL for currently selected interpreter [#560](https://github.com/DonJayamanne/pythonVSCode/issues/560)
* Fixes to debugging of modules [#589](https://github.com/DonJayamanne/pythonVSCode/issues/589)
* Reminder to install jedi and ctags in Quick Start [#642](https://github.com/DonJayamanne/pythonVSCode/pull/642)
* Improvements to Symbol Provider [#622](https://github.com/DonJayamanne/pythonVSCode/pull/622)
* Changes to disable unit test prompts for workspace [#559](https://github.com/DonJayamanne/pythonVSCode/issues/559)
* Minor fixes [#627](https://github.com/DonJayamanne/pythonVSCode/pull/627)

## Version 0.5.5 (25 November 2016)
* Fixes to debugging of unittests (nose and pytest) [#543](https://github.com/DonJayamanne/pythonVSCode/issues/543)
* Fixes to debugging of Django [#546](https://github.com/DonJayamanne/pythonVSCode/issues/546)

## Version 0.5.4 (24 November 2016)
* Fixes to installing missing packages [#544](https://github.com/DonJayamanne/pythonVSCode/issues/544)
* Fixes to indentation of blocks of code [#432](https://github.com/DonJayamanne/pythonVSCode/issues/432)
* Fixes to debugging of unittests [#543](https://github.com/DonJayamanne/pythonVSCode/issues/543)
* Fixes to extension when a workspace (folder) isn't open [#542](https://github.com/DonJayamanne/pythonVSCode/issues/542)

## Version 0.5.3 (23 November 2016)
* Added support for [PySpark](http://spark.apache.org/docs/0.9.0/python-programming-guide.html) [#539](https://github.com/DonJayamanne/pythonVSCode/pull/539), [#540](https://github.com/DonJayamanne/pythonVSCode/pull/540)
* Debugging unittests (UnitTest, pytest, nose) [#333](https://github.com/DonJayamanne/pythonVSCode/issues/333)
* Displaying progress for formatting [#327](https://github.com/DonJayamanne/pythonVSCode/issues/327)
* Auto indenting ```else:``` inside ```if``` and similar code blocks [#432](https://github.com/DonJayamanne/pythonVSCode/issues/432)
* Prefixing new lines with '#' when new lines are added in the middle of a comment string [#365](https://github.com/DonJayamanne/pythonVSCode/issues/365)
* Debugging python modules [#518](https://github.com/DonJayamanne/pythonVSCode/issues/518), [#354](https://github.com/DonJayamanne/pythonVSCode/issues/354)
    + Use new debug configuration ```Python Module```
* Added support for workspace symbols using Exuberant CTags [#138](https://github.com/DonJayamanne/pythonVSCode/issues/138)
    + New command ```Python: Build Workspace Symbols```
* Added ability for linter to ignore paths or files [#501](https://github.com/DonJayamanne/pythonVSCode/issues/501)
    + Add the following setting in ```settings.json```
```python
        "python.linting.ignorePatterns":  [
            ".vscode/*.py",
            "**/site-packages/**/*.py"
          ],
```
* Automatically adding brackets when autocompleting functions/methods [#425](https://github.com/DonJayamanne/pythonVSCode/issues/425)
    + To enable this feature, turn on the setting ```"python.autoComplete.addBrackets": true```
* Running nose tests with the arguments '--with-xunit' and '--xunit-file' [#517](https://github.com/DonJayamanne/pythonVSCode/issues/517)
* Added support for workspaceRootFolderName in settings.json [#525](https://github.com/DonJayamanne/pythonVSCode/pull/525), [#522](https://github.com/DonJayamanne/pythonVSCode/issues/522)
* Added support for workspaceRootFolderName in settings.json [#525](https://github.com/DonJayamanne/pythonVSCode/pull/525), [#522](https://github.com/DonJayamanne/pythonVSCode/issues/522)
* Fixes to running code in terminal [#515](https://github.com/DonJayamanne/pythonVSCode/issues/515)

## Version 0.5.2
* Fix issue with mypy linter [#505](https://github.com/DonJayamanne/pythonVSCode/issues/505)
* Fix auto completion for files with different encodings [#496](https://github.com/DonJayamanne/pythonVSCode/issues/496)
* Disable warnings when debugging Django version prior to 1.8 [#479](https://github.com/DonJayamanne/pythonVSCode/issues/479)
* Prompt to save changes when refactoring without saving any changes [#441](https://github.com/DonJayamanne/pythonVSCode/issues/441)
* Prompt to save changes when renaminv without saving any changes [#443](https://github.com/DonJayamanne/pythonVSCode/issues/443)
* Use editor indentation size when refactoring code [#442](https://github.com/DonJayamanne/pythonVSCode/issues/442)
* Add support for custom jedi paths [#500](https://github.com/DonJayamanne/pythonVSCode/issues/500)

## Version 0.5.1
* Prompt to install linter if not installed [#255](https://github.com/DonJayamanne/pythonVSCode/issues/255)
* Prompt to configure and install test framework
* Added support for pylama [#495](https://github.com/DonJayamanne/pythonVSCode/pull/495)
* Partial support for PEP484
* Linting python files when they are opened [#462](https://github.com/DonJayamanne/pythonVSCode/issues/462)
* Fixes to unit tests discovery [#307](https://github.com/DonJayamanne/pythonVSCode/issues/307),
[#459](https://github.com/DonJayamanne/pythonVSCode/issues/459)
* Fixes to intelliense [#438](https://github.com/DonJayamanne/pythonVSCode/issues/438),
[#433](https://github.com/DonJayamanne/pythonVSCode/issues/433),
[#457](https://github.com/DonJayamanne/pythonVSCode/issues/457),
[#436](https://github.com/DonJayamanne/pythonVSCode/issues/436),
[#434](https://github.com/DonJayamanne/pythonVSCode/issues/434),
[#447](https://github.com/DonJayamanne/pythonVSCode/issues/447),
[#448](https://github.com/DonJayamanne/pythonVSCode/issues/448),
[#293](https://github.com/DonJayamanne/pythonVSCode/issues/293),
[#381](https://github.com/DonJayamanne/pythonVSCode/pull/381)
* Supporting additional search paths for interpreters on windows [#446](https://github.com/DonJayamanne/pythonVSCode/issues/446)
* Fixes to code refactoring [#440](https://github.com/DonJayamanne/pythonVSCode/issues/440),
[#467](https://github.com/DonJayamanne/pythonVSCode/issues/467),
[#468](https://github.com/DonJayamanne/pythonVSCode/issues/468),
[#445](https://github.com/DonJayamanne/pythonVSCode/issues/445)
* Fixes to linters [#463](https://github.com/DonJayamanne/pythonVSCode/issues/463)
[#439](https://github.com/DonJayamanne/pythonVSCode/issues/439),
* Bug fix in handling nosetest arguments [#407](https://github.com/DonJayamanne/pythonVSCode/issues/407)
* Better error handling when linter fails [#402](https://github.com/DonJayamanne/pythonVSCode/issues/402)
* Restoring extension specific formatting [#421](https://github.com/DonJayamanne/pythonVSCode/issues/421)
* Fixes to debugger (unwanted breakpoints) [#392](https://github.com/DonJayamanne/pythonVSCode/issues/392), [#379](https://github.com/DonJayamanne/pythonVSCode/issues/379)
* Support spaces in python path when executing in terminal [#428](https://github.com/DonJayamanne/pythonVSCode/pull/428)
* Changes to snippets [#429](https://github.com/DonJayamanne/pythonVSCode/pull/429)
* Marketplace changes [#430](https://github.com/DonJayamanne/pythonVSCode/pull/430)
* Cleanup and miscellaneous fixes (typos, keyboard bindings and the liks)

## Version 0.5.0
* Remove dependency on zmq when using Jupyter or IPython (pure python solution)
* Added a default keybinding for ```Jupyter:Run Selection/Line``` of ```ctrl+alt+enter```
* Changes to update settings.json with path to python using [native API](https://github.com/DonJayamanne/pythonVSCode/commit/bce22a2b4af87eaf40669c6360eff3675280cdad)
* Changes to use [native API](https://github.com/DonJayamanne/pythonVSCode/commit/bce22a2b4af87eaf40669c6360eff3675280cdad) for formatting when saving documents
* Reusing existing terminal instead of creating new terminals
* Limiting linter messages to opened documents (hide messages if document is closed) [#375](https://github.com/DonJayamanne/pythonVSCode/issues/375)
* Resolving extension load errors when  [#375](https://github.com/DonJayamanne/pythonVSCode/issues/375)
* Fixes to discovering unittests [#386](https://github.com/DonJayamanne/pythonVSCode/issues/386)
* Fixes to sending code to terminal on Windows [#387](https://github.com/DonJayamanne/pythonVSCode/issues/387)
* Fixes to executing python file in terminal on Windows [#385](https://github.com/DonJayamanne/pythonVSCode/issues/385)
* Fixes to launching local help (documentation) on Linux
* Fixes to typo in configuration documentation [#391](https://github.com/DonJayamanne/pythonVSCode/pull/391)
* Fixes to use ```python.pythonPath``` when sorting imports  [#393](https://github.com/DonJayamanne/pythonVSCode/pull/393)
* Fixes to linters to handle situations when line numbers aren't returned [#399](https://github.com/DonJayamanne/pythonVSCode/pull/399)
* Fixes to signature tooltips when docstring is very long [#368](https://github.com/DonJayamanne/pythonVSCode/issues/368), [#113](https://github.com/DonJayamanne/pythonVSCode/issues/113)

## Version 0.4.2
* Fix for autocompletion and code navigation with unicode characters [#372](https://github.com/DonJayamanne/pythonVSCode/issues/372), [#364](https://github.com/DonJayamanne/pythonVSCode/issues/364)

## Version 0.4.1
* Debugging of [Django templates](https://github.com/DonJayamanne/pythonVSCode/wiki/Debugging-Django#templates)
* Linting with [mypy](https://github.com/DonJayamanne/pythonVSCode/wiki/Linting#mypy)
* Improved error handling when loading [Jupyter/IPython](https://github.com/DonJayamanne/pythonVSCode/wiki/Jupyter-(IPython))
* Fixes to unittests

## Version 0.4.0
* Added support for [Jupyter/IPython](https://github.com/DonJayamanne/pythonVSCode/wiki/Jupyter-(IPython))
* Added local help (offline documentation)
* Added ability to pass in extra arguments to interpreter when executing scripts ([#316](https://github.com/DonJayamanne/pythonVSCode/issues/316))
* Added ability set current working directory as the script file directory, when to executing a Python script
* Rendering intellisense icons correctly ([#322](https://github.com/DonJayamanne/pythonVSCode/issues/322))
* Changes to capitalization of context menu text ([#320](https://github.com/DonJayamanne/pythonVSCode/issues/320))
* Bug fix to running pydocstyle linter on windows ([#317](https://github.com/DonJayamanne/pythonVSCode/issues/317))
* Fixed performance issues with regards to code navigation, displaying code Symbols and the like ([#324](https://github.com/DonJayamanne/pythonVSCode/issues/324))
* Fixed code renaming issue when renaming imports ([#325](https://github.com/DonJayamanne/pythonVSCode/issues/325))
* Fixed issue with the execution of the command ```python.execInTerminal``` via a shortcut ([#340](https://github.com/DonJayamanne/pythonVSCode/issues/340))
* Fixed issue with code refactoring ([#363](https://github.com/DonJayamanne/pythonVSCode/issues/363))

## Version 0.3.24
* Added support for clearing cached tests [#307](https://github.com/DonJayamanne/pythonVSCode/issues/307)
* Added support for executing files in terminal with spaces in paths [#308](https://github.com/DonJayamanne/pythonVSCode/issues/308)
* Fix issue related to running unittests on Windows [#309](https://github.com/DonJayamanne/pythonVSCode/issues/309)
* Support custom environment variables when launching external terminal [#311](https://github.com/DonJayamanne/pythonVSCode/issues/311)

## Version 0.3.23
* Added support for the attribute supportsRunInTerminal attribute in debugger [#304](https://github.com/DonJayamanne/pythonVSCode/issues/304)
* Changes to ensure remote debugging resolves remote paths correctly [#302](https://github.com/DonJayamanne/pythonVSCode/issues/302)
* Added support for custom pytest and nosetest paths [#301](https://github.com/DonJayamanne/pythonVSCode/issues/301)
* Resolved issue in ```Watch``` window displaying ```<error:previous evaluation...``` [#301](https://github.com/DonJayamanne/pythonVSCode/issues/301)
* Reduce extension size by removing unwanted files [#296](https://github.com/DonJayamanne/pythonVSCode/issues/296)
* Updated code snippets

## Version 0.3.22
* Added few new snippets
* Integrated [Unit Tests](https://github.com/DonJayamanne/pythonVSCode/wiki/UnitTests)
* Selecting interpreter and updating ```settings.json```[Documentation]](https://github.com/DonJayamanne/pythonVSCode/wiki/Miscellaneous#select-an-interpreter), [#257](https://github.com/DonJayamanne/pythonVSCode/issues/257)
* Running a file or selection in terminal [Documentation](https://github.com/DonJayamanne/pythonVSCode/wiki/Miscellaneous#execute-in-python-terminal), [#261](https://github.com/DonJayamanne/pythonVSCode/wiki/Miscellaneous#execute-in-python-terminal) (new to [Visual Studio Code 1.5](https://code.visualstudio.com/Updates#_extension-authoring))
* Debugging an application using the integrated terminal window (new to [Visual Studio Code 1.5](https://code.visualstudio.com/Updates#_node-debugging))
* Running a python script without debugging [#118](https://github.com/DonJayamanne/pythonVSCode/issues/118)
* Displaying errors in variable explorer when debugging [#271](https://github.com/DonJayamanne/pythonVSCode/issues/271)
* Ability to debug applications as sudo [#224](https://github.com/DonJayamanne/pythonVSCode/issues/224)
* Fixed debugger crashes [#263](https://github.com/DonJayamanne/pythonVSCode/issues/263)
* Asynchronour display of unit tests [#190](https://github.com/DonJayamanne/pythonVSCode/issues/190)
* Fixed issues when using relative paths in ```settings.json``` [#276](https://github.com/DonJayamanne/pythonVSCode/issues/276)
* Fixes issue of hardcoding interpreter command arguments [#256](https://github.com/DonJayamanne/pythonVSCode/issues/256)
* Fixes resolving of remote paths when debugging remote applications [#252](https://github.com/DonJayamanne/pythonVSCode/issues/252)

## Version 0.3.20
* Sharing python.pythonPath value with debug configuration [#214](https://github.com/DonJayamanne/pythonVSCode/issues/214) and [#183](https://github.com/DonJayamanne/pythonVSCode/issues/183)
* Support extract variable and method refactoring [#220](https://github.com/DonJayamanne/pythonVSCode/issues/220)
* Support environment variables in settings [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Support formatting of selected text [#197](https://github.com/DonJayamanne/pythonVSCode/issues/197) and [#183](https://github.com/DonJayamanne/pythonVSCode/issues/183)
* Support autocompletion of parameters [#71](https://github.com/DonJayamanne/pythonVSCode/issues/71)
* Display name of linter along with diagnostic messages [#199](https://github.com/DonJayamanne/pythonVSCode/issues/199)
* Auto indenting of except and async functions [#205](https://github.com/DonJayamanne/pythonVSCode/issues/205) and [#215](https://github.com/DonJayamanne/pythonVSCode/issues/215)
* Support changes to pythonPath without having to restart VS Code [#216](https://github.com/DonJayamanne/pythonVSCode/issues/216)
* Resolved issue to support large debug outputs [#52](https://github.com/DonJayamanne/pythonVSCode/issues/52) and  [#52](https://github.com/DonJayamanne/pythonVSCode/issues/203)
* Handling instances when debugging with invalid paths to the python interpreter [#229](https://github.com/DonJayamanne/pythonVSCode/issues/229)
* Fixed refactoring on Python 3.5 [#244](https://github.com/DonJayamanne/pythonVSCode/issues/229)
* Fixed parsing errors when refactoring [#244](https://github.com/DonJayamanne/pythonVSCode/issues/229)

## Version 0.3.21
* Sharing python.pythonPath value with debug configuration [#214](https://github.com/DonJayamanne/pythonVSCode/issues/214) and [#183](https://github.com/DonJayamanne/pythonVSCode/issues/183)
* Support extract variable and method refactoring [#220](https://github.com/DonJayamanne/pythonVSCode/issues/220)
* Support environment variables in settings [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Support formatting of selected text [#197](https://github.com/DonJayamanne/pythonVSCode/issues/197) and [#183](https://github.com/DonJayamanne/pythonVSCode/issues/183)
* Support autocompletion of parameters [#71](https://github.com/DonJayamanne/pythonVSCode/issues/71)
* Display name of linter along with diagnostic messages [#199](https://github.com/DonJayamanne/pythonVSCode/issues/199)
* Auto indenting of except and async functions [#205](https://github.com/DonJayamanne/pythonVSCode/issues/205) and [#215](https://github.com/DonJayamanne/pythonVSCode/issues/215)
* Support changes to pythonPath without having to restart VS Code [#216](https://github.com/DonJayamanne/pythonVSCode/issues/216)
* Resolved issue to support large debug outputs [#52](https://github.com/DonJayamanne/pythonVSCode/issues/52) and  [#52](https://github.com/DonJayamanne/pythonVSCode/issues/203)
* Handling instances when debugging with invalid paths to the python interpreter [#229](https://github.com/DonJayamanne/pythonVSCode/issues/229)
* Fixed refactoring on Python 3.5 [#244](https://github.com/DonJayamanne/pythonVSCode/issues/229)

## Version 0.3.19
* Sharing python.pythonPath value with debug configuration [#214](https://github.com/DonJayamanne/pythonVSCode/issues/214) and [#183](https://github.com/DonJayamanne/pythonVSCode/issues/183)
* Support extract variable and method refactoring [#220](https://github.com/DonJayamanne/pythonVSCode/issues/220)
* Support environment variables in settings [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Support formatting of selected text [#197](https://github.com/DonJayamanne/pythonVSCode/issues/197) and [#183](https://github.com/DonJayamanne/pythonVSCode/issues/183)
* Support autocompletion of parameters [#71](https://github.com/DonJayamanne/pythonVSCode/issues/71)
* Display name of linter along with diagnostic messages [#199](https://github.com/DonJayamanne/pythonVSCode/issues/199)
* Auto indenting of except and async functions [#205](https://github.com/DonJayamanne/pythonVSCode/issues/205) and [#215](https://github.com/DonJayamanne/pythonVSCode/issues/215)
* Support changes to pythonPath without having to restart VS Code [#216](https://github.com/DonJayamanne/pythonVSCode/issues/216)
* Resolved issue to support large debug outputs [#52](https://github.com/DonJayamanne/pythonVSCode/issues/52) and  [#52](https://github.com/DonJayamanne/pythonVSCode/issues/203)
* Handling instances when debugging with invalid paths to the python interpreter [#229](https://github.com/DonJayamanne/pythonVSCode/issues/229)

## Version 0.3.18
* Modifications to support environment variables in settings [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Modifications to support formatting of selected text [#197](https://github.com/DonJayamanne/pythonVSCode/issues/197) and [#183](https://github.com/DonJayamanne/pythonVSCode/issues/183)
* Added support to intellisense for parameters [#71](https://github.com/DonJayamanne/pythonVSCode/issues/71)
* Display name of linter along with diagnostic messages [#199](https://github.com/DonJayamanne/pythonVSCode/issues/199)

## Version 0.3.15
* Modifications to handle errors in linters [#185](https://github.com/DonJayamanne/pythonVSCode/issues/185)
* Fixes to formatting and handling of not having empty lines at end of file [#181](https://github.com/DonJayamanne/pythonVSCode/issues/185)
* Modifications to infer paths of packages on windows [#178](https://github.com/DonJayamanne/pythonVSCode/issues/178)
* Fix for debugger crashes [#45](https://github.com/DonJayamanne/pythonVSCode/issues/45)
* Changes to App Insights key [#156](https://github.com/DonJayamanne/pythonVSCode/issues/156)
* Updated Jedi library to latest version [#173](https://github.com/DonJayamanne/pythonVSCode/issues/173)
* Updated iSort library to latest version [#174](https://github.com/DonJayamanne/pythonVSCode/issues/174)

## Version 0.3.14
* Modifications to handle errors in linters when the linter isn't installed.

## Version 0.3.13
* Fixed error message being displayed by linters and formatters

## Version 0.3.12
* Changes to how linters and formatters are executed (optimizations and changes to settings to separate out the command line arguments) [#178](https://github.com/DonJayamanne/pythonVSCode/issues/178), [#163](https://github.com/DonJayamanne/pythonVSCode/issues/163)
* Fix to support Unicode characters in debugger [#102](https://github.com/DonJayamanne/pythonVSCode/issues/102)
* Added support for {workspaceRoot} in Path settings defined in settings.js [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Resolving path of linters and formatters based on python path defined in settings.json [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Better handling of Paths to python executable and related tools (linters, formatters) in virtual environments [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Added support for configurationDone event in debug adapter [#168](https://github.com/DonJayamanne/pythonVSCode/issues/168), [#145](https://github.com/DonJayamanne/pythonVSCode/issues/145)

## Version 0.3.11
* Added support for telemetry #156
* Optimized code formatting and sorting of imports #150, #151, #157
* Fixed issues in code formatting #171
* Modifications to display errors returned by debugger #111
* Fixed the prospector linter #142
* Modified to resolve issues where debugger wasn't handling code exceptions correctly #159
* Added support for unit tests using pytest #164
* General code cleanup

## Version 0.3.10
* Fixed issue with duplicate output channels being created
* Fixed issues in the LICENSE file
* Fixed issue where current directory was incorrect [#68](https://github.com/DonJayamanne/pythonVSCode/issues/68)
* General cleanup of code

## Version 0.3.9
* Fixed auto indenting issues [#137](https://github.com/DonJayamanne/pythonVSCode/issues/137)

## Version 0.3.8
* Added support for linting using prospector [#130](https://github.com/DonJayamanne/pythonVSCode/pull/130)
* Fixed issue where environment variables weren't being inherited by the debugger [#109](https://github.com/DonJayamanne/pythonVSCode/issues/109) and [#77](https://github.com/DonJayamanne/pythonVSCode/issues/77)

## Version 0.3.7
* Added support for auto indenting of some keywords [#83](https://github.com/DonJayamanne/pythonVSCode/issues/83)
* Added support for launching console apps for Mac [#128](https://github.com/DonJayamanne/pythonVSCode/issues/128)
* Fixed issue where configuration files for pylint, pep8 and flake8 commands weren't being read correctly [#117](https://github.com/DonJayamanne/pythonVSCode/issues/117)

## Version 0.3.6
* Added support for linting using pydocstyle [#56](https://github.com/DonJayamanne/pythonVSCode/issues/56)
* Added support for auto-formatting documents upon saving (turned off by default) [#27](https://github.com/DonJayamanne/pythonVSCode/issues/27)
* Added support to configure the output window for linting, formatting and unit test messages [#112](https://github.com/DonJayamanne/pythonVSCode/issues/112)

## Version 0.3.5
* Fixed printing of unicode characters when evaulating expressions [#73](https://github.com/DonJayamanne/pythonVSCode/issues/73)

## Version 0.3.4
* Updated snippets
* Fixes to remote debugging [#65](https://github.com/DonJayamanne/pythonVSCode/issues/65)
* Fixes related to code navigation [#58](https://github.com/DonJayamanne/pythonVSCode/issues/58) and [#78](https://github.com/DonJayamanne/pythonVSCode/pull/78)
* Changes to allow code navigation for methods

## Version 0.3.0
* Remote debugging (attaching to local and remote processes)
* Debugging with support for shebang
* Support for passing environment variables to debug program
* Improved error handling in the extension

## Version 0.2.9
* Added support for debugging django applications
 + Debugging templates is not supported at this stage

## Version 0.2.8
* Added support for conditional break points
* Added ability to optionally display the shell window (Windows Only, Mac is coming soon)
  +  Allowing an interactive shell window, which isn't supported in VSCode.
* Added support for optionally breaking into python code as soon as debugger starts
* Fixed debugging when current thread is busy processing.
* Updated documentation with samples and instructions

## Version 0.2.4
* Fixed issue where debugger would break into all exceptions
* Added support for breaking on all and uncaught exceptions
* Added support for pausing (breaking) into a running program while debugging.

## Version 0.2.3
* Fixed termination of debugger

## Version 0.2.2
* Improved debugger for Mac, with support for Multi threading, Web Applications, expanding properties, etc
* (Debugging now works on both Windows and Mac)
* Debugging no longer uses PDB

## Version 0.2.1
* Improved debugger for Windows, with support for Multi threading, debugging Multi-threaded apps, Web Applications, expanding properties, etc
* Added support for relative paths for extra paths in additional libraries for Auto Complete
* Fixed a bug where paths to custom Python versions weren't respected by the previous (PDB) debugger
* NOTE: PDB Debugger is still supported

## Version 0.1.3
* Fixed linting when using pylint

## Version 0.1.2
* Fixed autoformatting of code (falling over when using yapf8)

## Version 0.1.1
* Fixed linting of files on Mac
* Added support for linting using pep8
* Added configuration support for pep8 and pylint
* Added support for configuring paths for pep8, pylint and autopep8
* Added snippets
* Added support for formatting using yapf
* Added a number of configuration settings

## Version 0.0.4
* Added support for linting using Pylint (configuring pylint is coming soon)
* Added support for sorting Imports (Using the command "Pythong: Sort Imports")
* Added support for code formatting using Autopep8 (configuring autopep8 is coming soon)
* Added ability to view global variables, arguments, add and remove break points

## Version 0.0.3
* Added support for debugging using PDB
