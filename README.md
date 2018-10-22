# Python extension for Visual Studio Code

A [Visual Studio Code](https://code.visualstudio.com/) [extension](https://marketplace.visualstudio.com/VSCode) with rich support for the [Python language](https://www.python.org/) (for all [actively supported versions](https://devguide.python.org/#status-of-python-branches) of the language: 2.7, >=3.4), including features such as linting, debugging, IntelliSense, code navigation, code formatting, refactoring, unit tests, snippets, and more!

## Quick start

* **Step 1.** [Install a supported version of Python on your system](https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites) (note: that the system install of Python on macOS is not supported).
* **Step 2.** Install the Python extension for Visual Studio Code.
* **Step 3.** Open or create a Python file and start coding!

## Optional steps
* **Step 4.** [Install a linter](https://code.visualstudio.com/docs/python/linting) to get errors and warnings -- you can further customize linting rules to fit your needs.
* **Step 5.** Select your preferred Python interpreter/version/environment using the `Select Interpreter` command.
  + By default we use the one that's on your path.
  + If you have a workspace open you can also click in the status bar to change the interpreter.
* **Step 6.** Install `ctags` for Workspace Symbols, from [here](http://ctags.sourceforge.net/), or using `brew install ctags` on macOS.

For more information you can:
* [Follow our Python tutorial](https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites) with step-by-step instructions for building a simple app.
* Check out the [Python documentation on the VS Code site](https://code.visualstudio.com/docs/languages/python) for general information about using the extension.

## Useful commands

Open the Command Palette (Command+Shift+P on macOS and Ctrl+Shift+P on Windows/Linux) and type in one of the following commands:

Command | Description
--- | ---
```Python: Select Interpreter``` | Switch between Python interpreters, versions, and environments.
```Python: Start REPL``` | Start an interactive Python REPL using the selected interpreter in the VS Code terminal.
```Python: Run Python File in Terminal``` | Runs the active Python file in the VS Code terminal. You can also run a Python file by right-clicking on the file and selecting ```Run Python File in Terminal```.
```Python: Select Linter``` | Switch from PyLint to flake8 or other supported linters.

To see all available Python commands, open the Command Palette and type ```Python```.

## Supported locales

The extension is available in multiple languages thanks to external
contributors (if you would like to contribute a translation, see the
[pull request which added Italian](https://github.com/Microsoft/vscode-python/pull/1152)):

* `de`
* `en`
* `es`
* `fr`
* `it`
* `ja`
* `ko-kr`
* `pt-br`
* `ru`
* `zh-cn`
* `zh-tw`

## Questions, issues, feature requests, and contributions

* If you have a question about how to accomplish something with the extension, please [ask on Stack Overflow](https://stackoverflow.com/questions/tagged/visual-studio-code+python)
* If you come across a problem with the extension, please [file an issue](https://github.com/microsoft/vscode-python)
* Contributions are always welcome! Please see our [contributing guide](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING.md) for more details
* Any and all feedback is appreciated and welcome!
  - If someone has already [filed an issue](https://github.com/Microsoft/vscode-python) that encompasses your feedback, please leave a 👍/👎 reaction on the issue
  - Otherwise please file a new issue
* If you're interested in the development of the extension, you can read about our [development process](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING.md#development-process)

## Feature details

* IDE-like features
  + Automatic indenting
  + Code navigation ("Go to", "Find all" references)
  + Code definition (Peek and hover definition, View signatures)
  + Rename refactoring
  + Sorting import statements (use the `Python: Sort Imports` command)
* Intellisense and autocomplete (including PEP 484 and PEP 526 support)
  + Ability to include custom module paths (e.g. include paths for libraries like Google App Engine, etc.; use the setting `python.autoComplete.extraPaths = []`)
* Code formatting
  + Auto formatting of code upon saving changes (default to 'Off')
  + Use either [yapf](https://pypi.org/project/yapf/), [autopep8](https://pypi.org/project/autopep8/), or [Black](https://pypi.org/project/black/) for code formatting (defaults to autopep8)
* Linting
  + Support for multiple linters with custom settings (default is [Pylint](https://pypi.org/project/pylint/), but [Prospector](https://pypi.org/project/prospector/), [Flake8](https://pypi.org/project/flake8/), [pylama](https://pypi.org/project/pylama/), [pydocstyle](https://pypi.org/project/pydocstyle/), and [mypy](https://pypi.org/project/mypy/) are also supported)
* Debugging
  + Watch window
  + Evaluate expressions
  + Step through code ("Step in", "Step out", "Continue")
  + Add/remove breakpoints
  + Local variables and arguments
  + Multi-threaded applications
  + Web applications (such as [Flask](http://flask.pocoo.org/) & [Django](https://www.djangoproject.com/), with template debugging)
  + Expanding values (viewing children, properties, etc)
  + Conditional breakpoints
  + Remote debugging (over SSH)
  + Google App Engine
  + Debugging in the integrated or external terminal window
  + Debugging as sudo
* Unit testing
  + Support for [unittest](https://docs.python.org/3/library/unittest.html#module-unittest), [pytest](https://pypi.org/project/pytest/), and [nose](https://pypi.org/project/nose/)
  + Ability to run all failed tests, individual tests
  + Debugging unit tests
* Snippets
* Miscellaneous
  + Running a file or selected text in python terminal
  + Automatic activation of environments in the terminal
* Refactoring
  + Rename refactorings
  + Extract variable refactorings
  + Extract method refactorings
  + Sort imports

![General Features](https://raw.githubusercontent.com/microsoft/vscode-python/master/images/general.gif)

![Debugging](https://raw.githubusercontent.com/microsoft/vscode-python/master/images/debugDemo.gif)

![Unit Tests](https://raw.githubusercontent.com/microsoft/vscode-python/master/images/unittest.gif)


## Data and telemetry

The Microsoft Python Extension for Visual Studio Code collects usage
data and sends it to Microsoft to help improve our products and
services. Read our
[privacy statement](https://privacy.microsoft.com/privacystatement) to
learn more. This extension respects the `telemetry.enableTelemetry`
setting which you can learn more about at
https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting.
