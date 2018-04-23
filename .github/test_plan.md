# Test plan

## Environment

- OS: XXX
- Python
  - Distribution: XXX
  - Version: XXX

## Tests

**ALWAYS check the `Output` window under `Python` for logged errors!**

### [Environment](https://code.visualstudio.com/docs/python/environments)
#### Interpreters

- [ ] Interpreter is [shown in the status bar](https://code.visualstudio.com/docs/python/environments#_choosing-an-environment)
- [ ] An interpreter can be manually specified using the [`Select Interpreter` command](https://code.visualstudio.com/docs/python/environments#_choosing-an-environment)
- [ ] Detected system-installed interpreters
- [ ] Detected an Anaconda installation
- [ ] (Linux/macOS) Detected all interpreters installed w/ [pyenv](https://github.com/pyenv/pyenv) detected
- [ ] [`"python.pythonPath"`](https://code.visualstudio.com/docs/python/environments#_manually-specifying-an-interpreter) triggers an update in the status bar
- [ ] `Run Python File in Terminal`
- [ ] `Run Selection/Line in Python Terminal`

#### Virtual environments

**ALWAYS create environments with a space in their name.***

- [ ] Detected a single virtual environment at the top-level of the workspace folder
  - [ ] Appropriate suffix label specified in status bar
  - [ ] Prompt to install Pylint uses `--user`
  - [ ] `"python.terminal.activateEnvironments": false` deactivates detection
  - [ ] [`Create Terminal`](https://code.visualstudio.com/docs/python/environments#_activating-an-environment-in-the-terminal) works
- [ ] Detect multiple virtual environments in a directory specified by `"python.venvPath"`
- [ ] Detected all [conda environments created with an interpreter](https://code.visualstudio.com/docs/python/environments#_conda-environments)
  - [ ] Appropriate suffix label specified in status bar
  - [ ] Prompt to install Pylint installs into the conda environment
  - [ ] `"python.terminal.activateEnvironments": false` deactivates detection
  - [ ] [`Create Terminal`](https://code.visualstudio.com/docs/python/environments#_activating-an-environment-in-the-terminal) works
- [ ] (Linux/macOS until [`-m` is supported](https://github.com/Microsoft/vscode-python/issues/978)) Detected the virtual environment created by [pipenv](https://docs.pipenv.org/)
  - [ ] Appropriate suffix label specified in status bar
  - [ ] Prompt to install Pylint uses `pipenv install --dev`
  - [ ] `"python.terminal.activateEnvironments": false` deactivates detection
  - [ ] [`Create Terminal`](https://code.visualstudio.com/docs/python/environments#_activating-an-environment-in-the-terminal) works
- [ ] (Linux/macOS) Detected virtual environments created under `{workspaceFolder}/.direnv/python-{python_version}` for [direnv](https://direnv.net/) and its [`layout python3`](https://github.com/direnv/direnv/blob/master/stdlib.sh) support
  - [ ] Appropriate suffix label specified in status bar
  - [ ] `"python.terminal.activateEnvironments": false` deactivates detection

#### [Environment files](https://code.visualstudio.com/docs/python/environments#_environment-variable-definitions-file)
Sample files:
```python3
# example.py
import os
print('Hello,', os.environ.get('WHO'), '!')
```
```
# .env
WHO=world
```

- [ ] Environment variables in a `.env` file are exposed when running under the debugger
- [ ] `"python.envFile"` allows for specifying an environment file manually

#### [Debugging](https://code.visualstudio.com/docs/python/environments#_python-interpreter-for-debugging)

- [ ] `pythonPath` setting in your `launch.json` overrides your `python.pythonPath` default setting

### [Linting](https://code.visualstudio.com/docs/python/linting)

**ALWAYS check under the `Problems` tab to see e.g. if a linter is raising errors!**

#### Pylint/default linting
[Prompting to install Pylint is covered under `Environments` above]

For testing the disablement of the default linting rules for Pylint:
```ini
# pylintrc
[MESSAGES CONTROL]
enable=bad-names
```
```python3
# example.py
foo = 42  # Marked as a blacklisted name.
```
- [ ] Installation via the prompt installs Pylint as appropriate
- [ ] Pylint works
- [ ] `"python.linting.pylintUseMinimalCheckers": false` turns off the default rules w/ no `pylintrc` file present
- [ ] The existense of a `pylintrc` file turns off the default rules

#### Other linters

- [ ] flake8 works
- [ ] mypy works
- [ ] pydocstyle works
- [ ] pep8 works
- [ ] prospector works
- [ ] pylama works
- [ ] 3 or more linters work simultaneously
  - [ ] `Run Linting` runs all linters
  - [ ] The `Select Linter` command lists all the above linters and prompts to install a linter when missing
  - [ ] `"python.linting.enabled"` disables all linters
  - [ ] The `Enable Linting` command changes `"python.linting.enabled"`
  - [ ] `"python.linting.lintOnSave` works

### [Editing](https://code.visualstudio.com/docs/python/editing)

#### [IntelliSense](https://code.visualstudio.com/docs/python/editing#_autocomplete-and-intellisense)

Please also test for general accuracy on the most "interesting" code you can find.

- [ ] `"python.autoComplete.extraPaths"` works
- [ ] `"python.autoComplete.preloadModules"` works
- [ ] `"python.autocomplete.addBrackets": true` causes auto-completion of functions to append `()`

#### [Formatting](https://code.visualstudio.com/docs/python/editing#_formatting)

- [ ] autopep8 works
- [ ] yapf works
- [ ] `"editor.formatOnType": true` works and has expected results

#### [Refactoring](https://code.visualstudio.com/docs/python/editing#_refactoring)

- [ ] [`Extract Variable`](https://code.visualstudio.com/docs/python/editing#_extract-variable) works
- [ ] [`Extract method`](https://code.visualstudio.com/docs/python/editing#_extract-method) works
- [ ] [`Sort Imports`](https://code.visualstudio.com/docs/python/editing#_sort-imports) works

### [Debugging](https://code.visualstudio.com/docs/python/debugging)

Test **both** old and new debugger (and notice if the new debugger seems _at least_ as fast as the old debugger).

- [ ] [Configurations](https://code.visualstudio.com/docs/python/debugging#_debugging-specific-app-types) work
  - [ ] `Current File`
  - [ ] `Module`
  - [ ] `Attach`
  - [ ] `Terminal (integrated)`
  - [ ] `Terminal (external)`
  - [ ] `Django`
  - [ ] `Flask`
  - [ ] `Pyramid`
  - [ ] `Watson`
  - [ ] `Scrapy`
  - [ ] `PySpark`
  - [ ] `All debug Options` with [appropriate values](https://code.visualstudio.com/docs/python/debugging#_standard-configuration-and-options) changed
- [ ] Breakpoints
  - [ ] Set
  - [ ] Hit
  - [ ] Watch
- [ ] Stepping
  - [ ] Over
  - [ ] Into
  - [ ] Out
- [ ] Can inspect variables
  - [ ] Through hovering over variable in code
  - [ ] `Variables` section of debugger sidebar
- [ ] [Remote debugging](https://code.visualstudio.com/docs/python/debugging#_remote-debugging) works
  - [ ] ... over SSH
- [ ] [App Engine](https://code.visualstudio.com/docs/python/debugging#_google-app-engine-debugging)

### [Unit testing](https://code.visualstudio.com/docs/python/unit-testing)

#### [`unittest`](https://code.visualstudio.com/docs/python/unit-testing#_unittest-configuration-settings)
```python
import unittest

class PassingTests(unittest.TestCase):

    def test_passing(self):
        self.assertEqual(42, 42)

    def test_passing_still(self):
        self.assertEqual("silly walk", "silly walk")


class FailingTests(unittest.TestCase):

    def test_failure(self):
        self.assertEqual(42, -13)

    def test_failure_still(self):
        self.assertEqual("I'm right!", "no, I am!")
```
- [ ] `Run All Unit Tests` triggers the prompt to configure the test runner
- [ ] Tests are discovered (as shown by code lenses on each test)

#### [`pytest`](https://code.visualstudio.com/docs/python/unit-testing#_pytest-configuration-settings)
```python
def test_passing():
    assert 42 == 42

def test_failure():
    assert 42 == -13
```

- [ ] `Run All Unit Tests` triggers the prompt to configure the test runner
  - [ ] Pytest gets installed
- [ ] Tests are discovered (as shown by code lenses on each test)

#### [`nose`](https://code.visualstudio.com/docs/python/unit-testing#_nose-configuration-settings)
```python
def test_passing():
    assert 42 == 42

def test_failure():
    assert 42 == -13
```

- [ ] `Run All Unit Tests` triggers the prompt to configure the test runner
  - [ ] Nose gets installed
- [ ] Tests are discovered (as shown by code lenses on each test)

#### General

- [ ] Code lenses appears
  - [ ] `Run Test` lens works (and status bar updates as appropriate)
  - [ ] `Debug Test` lens works
  - [ ] Appropriate ✔/❌ shown for each test
- [ ] Status bar is functioning
  - [ ] Appropriate test results displayed
  - [ ] `Run All Unit Tests` works
  - [ ] `Discover Unit Tests` works (resets tests result display in status bar)
  - [ ] `Run Unit Test Method ...` works
  - [ ] `View Unit Test Output` works
  - [ ] After having at least one failure, `Run Failed Tests` works
