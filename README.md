# Python extension for Visual Studio Code

A [Visual Studio Code](https://code.visualstudio.com/) [extension](https://marketplace.visualstudio.com/VSCode) with rich support for the [Python language](https://www.python.org/) (_including Python 3.6_), with features including the following and more:
* Linting ([Prospector](https://pypi.io/project/prospector/), [Pylint](https://pypi.io/project/pylint/), [pycodestyle](https://pypi.io/project/pycodestyle/), [Flake8](https://pypi.io/project/flake8/), [pylama](https://github.com/klen/pylama), [pydocstyle](https://pypi.io/project/pydocstyle/), [mypy](http://mypy-lang.org/) with config files and plugins)
* Intellisense (autocompletion with support for PEP 484 and PEP 526)
* Auto indenting
* Code formatting ([autopep8](https://pypi.io/project/autopep8/), [yapf](https://pypi.io/project/yapf/), with config files)
* Code refactoring (Rename, Extract Variable, Extract Method,Sort Imports)
* Viewing references, code navigation, view signature
* Excellent debugging support (remote debugging over SSH, mutliple threads, django, flask)
* Running and debugging Unit tests ([unittest](https://docs.python.org/3/library/unittest.html#module-unittest), [pytest](https://pypi.io/project/pytest/), [nose](https://pypi.io/project/nose/), with config files)
* Execute file or code in a python terminal
* Local help file (offline documentation)
* Snippets

## Quick Start
* Install the extension
* optionally install `ctags` for Workspace Symbols, from [here](http://ctags.sourceforge.net/), or using `brew install ctags` on macOS
* Select your Python interpreter
  + If it's already in your path then you're set
  + Otherwise, to select a different Python Interpreter/Version (or use a virtual environment), use the command `Select Workspace Interpreter`)

## [Documentation](https://aka.ms/pvsc-docs)
For further information and details continue through to the [documentation](https://aka.ms/pvsc-docs).

## Issues, Feature Requests, and Contributions
* If you come across a problem with the extension please [file an issue](https://github.com/microsoft/vscode-python)
* Contributions are always welcome! Please see our [contributing guide](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING.md) for more details
* Any and all feedback is appreciated and welcome!
  - If someone has already [file an issue](https://github.com/Microsoft/vscode-python) that encompasses your feedback, please leave a 👍/👎 reaction on the issue
  - Othewise please file a new issue

## Feature Details
* IDE-like Features
  + Automatic indenting
  + Code navigation ("Go to", "Find all" references)
  + Code definition (Peek and hover definition, View signatures)
  + Rename refactoring
  + Sorting import statements (use the `Python: Sort Imports` command)
* Intellisense and Autocomplete (including PEP 484 support)
  + Ability to include custom module paths (e.g. include paths for libraries like Google App Engine, etc.; use the setting `python.autoComplete.extraPaths = []`)
* Code formatting
  + Auto formatting of code upon saving changes (default to 'Off')
  + Use either [yapf](https://pypi.io/project/yapf/) or [autopep8](https://pypi.io/project/autopep8/) for code formatting (defaults to autopep8)
* Linting
  + Support for multiple linters with custom settings (default is [Pylint](https://pypi.io/project/pylint/), but [Prospector](https://pypi.io/project/prospector/), [pycodestyle](https://pypi.io/project/pycodestyle/), [Flake8](https://pypi.io/project/flake8/), [pylama](https://github.com/klen/pylama), [pydocstyle](https://pypi.io/project/pydocstyle/), and [mypy](http://mypy-lang.org/) are also supported)
* Debugging
  + Watch window
  + Evaluate Expressions
  + Step through code ("Step in", "Step out", "Continue")
  + Add/remove break points
  + Local variables and arguments
  + Multi-threaded applications
  + Web applications (such as [Flask](http://flask.pocoo.org/) & [Django](https://www.djangoproject.com/), with template debugging)
  + Expanding values (viewing children, properties, etc)
  + Conditional break points
  + Remote debugging (over SSH)
  + Google App Engine
  + Debugging in the integrated or external terminal window
  + Debugging as sudo
* Unit Testing
  + Support for [unittest](https://docs.python.org/3/library/unittest.html#module-unittest), [pytest](https://pypi.io/project/pytest/), and [nose](https://pypi.io/project/nose/)
  + Ability to run all failed tests, individual tests
  + Debugging unit tests
* Snippets
* Miscellaneous
  + Running a file or selected text in python terminal
* Refactoring
  + Rename Refactorings
  + Extract Variable Refactorings
  + Extract Method Refactorings
  + Sort Imports

![General Features](https://raw.githubusercontent.com/microsoft/vscode-python/master/images/general.gif)

![Debugging](https://raw.githubusercontent.com/microsoft/vscode-python/master/images/debugDemo.gif)

![Unit Tests](https://raw.githubusercontent.com/microsoft/vscode-python/master/images/unittest.gif)


## Data/Telemetry
The Microsoft Python Extension for Visual Studio Code collects usage
data and sends it to Microsoft to help improve our products and
services. Read our
[privacy statement](https://privacy.microsoft.com/privacystatement) to
learn more. This extension respects the `telemetry.enableTelemetry`
setting which you can learn more about at
https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting.
