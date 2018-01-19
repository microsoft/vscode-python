# Python extension for Visual Studio Code

A [Visual Studio Code](https://code.visualstudio.com/) [extension](https://marketplace.visualstudio.com/VSCode) with rich support for the [Python language](https://www.python.org/) (_including Python 3.6_), with features such as linting, debugging, IntelliSense, code navigation, code formatting, refactoring, unit tests, snippets, and more!

## Quick Start

* **Step 1.** [Install a supported version of Python on your system](https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites) (note: that the system install of Python on macOS is not supported)
* **Step 2.** Install the extension
* **Step 3.** Open or create a Python file and start coding!

### Optional
* **Step 4.** [Install a linter](https://code.visualstudio.com/docs/python/linting) to get errors and warnings -- you can further customize linting rules to fit your needs
* **Step 5.** Select your preferred Python interpreter
  + By default we use the one that's on your path
  + To select a different Python interpreter/version/environment (use the command `Select Interpreter`, or if you have a workspace open you can click in the status bar)
* **Step 6.** Install `ctags` for Workspace Symbols, from [here](http://ctags.sourceforge.net/), or using `brew install ctags` on macOS

You can [follow our Python tutorial](https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites) for step-by-step instructions for building a simple app, and check out the [Python documentation on the VS Code site](https://code.visualstudio.com/docs/languages/python) for more information.

## Useful Commands

Open the Command Palette (Command+Shift+P on macOS and Ctrl+Shift+P on Windows/Linux) and type in one of the following commands:

Command | Description 
--- | --- 
```Python: Select Interpreter``` | Switch between Python interpreters, versions, and environments.
```Python: Start REPL``` | Start an interactive Python REPL using the selected interpreter in the VS Code terminal.
```Python: Run Python File in Terminal``` | Runs the active Python file in the VS Code terminal. You can also run a Python file by right-clicking on the file and selecting ```Run Python File in Terminal```.
```Python: Select Linter``` | Switch from PyLint to flake8 or other supported linters.

## Supported locales

The extension is available in multiple languages thanks to external
contributors (if you would like to contribute a translation, see the
[pull request which added simplified Chinese](https://github.com/Microsoft/vscode-python/pull/240)):

* `en`
* `ja`
* `ru`
* `zh-cn`

## Questions, Issues, Feature Requests, and Contributions

* If you have a question about how to accomplish something with the extension, please [ask on Stack Overflow](https://stackoverflow.com/questions/tagged/visual-studio-code+python)
* If you come across a problem with the extension, please [file an issue](https://github.com/microsoft/vscode-python)
* Contributions are always welcome! Please see our [contributing guide](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING.md) for more details
* Any and all feedback is appreciated and welcome!
  - If someone has already [file an issue](https://github.com/Microsoft/vscode-python) that encompasses your feedback, please leave a 👍/👎 reaction on the issue
  - Otherwise please file a new issue

## Feature Details

* IDE-like Features
  + Automatic indenting
  + Code navigation ("Go to", "Find all" references)
  + Code definition (Peek and hover definition, View signatures)
  + Rename refactoring
  + Sorting import statements (use the `Python: Sort Imports` command)
* Intellisense and Autocomplete (including PEP 484 and PEP 526 support)
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
