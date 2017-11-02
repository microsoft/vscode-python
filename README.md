# Python

An extension with rich support for the [Python language](https://www.python.org/) (_including Python 3.6_), with features including the following and more:
* Linting ([Prospector](https://pypi.io/project/prospector/), [Pylint](https://pypi.io/project/pylint/), [pycodestyle/pep257/pep8](https://pypi.io/project/pycodestyle/), [Flake8](https://pypi.io/project/flake8/), [pylama](https://github.com/klen/pylama), [pydocstyle](https://pypi.io/project/pydocstyle/), [mypy](http://mypy-lang.org/) with config files and plugins)
* Intellisense (autocompletion with support for PEP-0484 and PEP 526)
* Auto indenting
* Code formatting ([autopep8](https://pypi.io/project/autopep8/), [yapf](https://pypi.io/project/yapf/), with config files)
* Code refactoring ([Rename](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Rename), [Extract Variable](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Variable), [Extract Method](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Method), [Sort Imports](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Sort-Imports))
* Viewing references, code navigation, view signature
* Excellent debugging support (remote debugging over SSH, mutliple threads, django, flask)
* Running and debugging Unit tests ([unittest](https://docs.python.org/3/library/unittest.html#module-unittest), [pytest](https://pypi.io/project/pytest/), [nosetests](https://pypi.io/project/nose/), with config files)
* Execute file or code in a python terminal
* Local help file (offline documentation)
* Snippets

## Quick Start
* Install the extension
* optionally install `ctags` for Workspace Symbols, from [here](http://ctags.sourceforge.net/), or using `brew install ctags` on OSX.
* If Python is in the current path
  + You're ready to use it.
* To select a different Python Interpreter/Version (or use Virtual Environment), use the command [```Select Workspace Interpreter```](https://github.com/DonJayamanne/pythonVSCode/wiki/Miscellaneous#select-an-interpreter))

## [Documentation](https://github.com/DonJayamanne/pythonVSCode/wiki)
For further information and details continue through to the [documentation](https://github.com/DonJayamanne/pythonVSCode/wiki).

## [Issues, Feature Requests and Contributions](https://github.com/DonJayamanne/pythonVSCode/issues)
* Contributions are always welcome. Fork it, modify it and create a pull request.
  + Details on contributing can be found [here](https://github.com/DonJayamanne/pythonVSCode/wiki/Contribution)
* Any and all feedback is appreciated and welcome.
  + Please feel free to [add suggestions here](https://github.com/DonJayamanne/pythonVSCode/issues/183)

## Feature Details
* IDE Features
  + Auto indenting
  + Code navigation (Go to, Find all references)
  + Code definition (Peek and hover definition, View Signature)
  + Rename refactoring
  + Sorting Import statements (use "Python: Sort Imports" command)
* [Intellisense and Autocomplete](https://github.com/DonJayamanne/pythonVSCode/wiki/Autocomplete-Intellisense) with support for PEP-0484
  + Ability to include custom module paths (e.g. include paths for libraries like Google App Engine, etc.)
  + Use the `setting python.autoComplete.extraPaths = []`
  + For instance getting autocomplete/intellisense for Google App Engine, add the following to your settings file:
```json
"python.autoComplete.extraPaths": [
    "C:/Program Files (x86)/Google/google_appengine",
    "C:/Program Files (x86)/Google/google_appengine/lib" ]
```
* [Scientific tools (Jupyter/IPython)](https://marketplace.visualstudio.com/items?itemName=donjayamanne.python)
  + This functionality has been moved into a separate extension [Jupyter](https://marketplace.visualstudio.com/items?itemName=donjayamanne.jupyter)
* [Code formatting](https://github.com/DonJayamanne/pythonVSCode/wiki/Formatting)
  + Auto formatting of code upon saving changes (default to 'Off')
  + Use either yapf or autopep8 for code formatting (defaults to autopep8)
* [Linting](https://github.com/DonJayamanne/pythonVSCode/wiki/Linting)
  + It can be turned off (default is to be turned on and use pylint)
  + Multiple linters supported (along with support for configuration files for each linter)
  + Supported linters include pylint, pep8, flake8, pydocstyle, prospector
  + Paths to each of the linters can be optionally configured
  + Custom plugins such as pylint plugin for Django can be easily used by modifying the settings as follows:
```json
"python.linting.pylintArgs": ["--load-plugins", "pylint_django"]
```
* [Debugging](https://github.com/DonJayamanne/pythonVSCode/wiki/Debugging)
  + Watch window
  + Evaluate Expressions
  + Step through code (Step in, Step out, Continue)
  + Add/remove break points
  + Local variables and arguments
  + Multiple Threads and Web Applications (such as Flask, Django, with template debugging)
  + Expanding values (viewing children, properties, etc)
  + Conditional break points
  + Remote debugging (over SSH)
  + Google App Engine
  + Debugging in the integrated or external terminal window
  + Debugging as sudo
* [Unit Testing](https://github.com/DonJayamanne/pythonVSCode/wiki/UnitTests)
  + Support for unittests, nosetests and pytest
  + Test results are displayed in the "Python" output window
  + Run failed tests, individual tests
  + Debugging unittests
* Snippets
* Miscellaneous
  + Running a file or selected text in python terminal
* Refactoring
  + [Rename Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Rename)
  + [Extract Variable Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Variable)
  + [Extract Method Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Method)
  + [Sort Imports](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Sort-Imports)

![Generate Features](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/general.gif)

![Debugging](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/debugDemo.gif)

![Unit Tests](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/unittest.gif)

![Scientific Tools](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/jupyter/examples.gif)

![Local Help](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/help.gif)

## [Roadmap](https://donjayamanne.github.io/pythonVSCodeDocs/docs/roadmap/)

## [Change Log](https://github.com/DonJayamanne/pythonVSCode/blob/master/CHANGELOG.md)

### Version 0.7.0 (3 August 2017)
* Displaying internal documntation [#1008](https://github.com/DonJayamanne/pythonVSCode/issues/1008), [#10860](https://github.com/DonJayamanne/pythonVSCode/issues/10860)
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

## Source

[GitHub](https://github.com/microsoft/vscode-python)


## License

[MIT](https://raw.githubusercontent.com/microsoft/vscode-python/master/LICENSE)


## Data/Telemetry
The Microsoft Python Extension for Visual Studio Code collects usage
data and sends it to Microsoft to help improve our products and
services. Read our
[privacy statement](https://privacy.microsoft.com/privacystatement) to
learn more. This extension respects the `telemetry.enableTelemetry`
setting which you can learn more about at
https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting.
