# Test plan

## Environment

- OS: XXX (Windows, macOS, latest Ubuntu LTS)
  - Shell: XXX (Command Prompt, PowerShell, bash, fish)
- Python
  - Distribution: XXX (CPython, miniconda)
  - Version: XXX (2.7, latest 3.x)
- VS Code: XXX (Insiders)

## Tests

**ALWAYS**:
- Check the `Output` window under `Python` for logged errors
- Have `Developer Tools` open to detect any errors
- Consider running the tests in a multi-folder workspace
- Focus on in-development features (i.e. experimental debugger and language server)

<details>
  <summary>Scenarios</summary>

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
  - [ ] Right-click
  - [ ] Command
  - [ ] `Shift+Enter`

#### Virtual environments

**ALWAYS**:
- Use the latest version of Anaconda
- Realize that `conda` is slow
- Create an environment with a space in their path somewhere as well as upper and lowercase characters
- Make sure that you do not have `python.pythonPath` specified in your `settings.json` when testing automatic detection
- Do note that the `Select Interpreter` drop-down window scrolls

- [ ] Detected a single virtual environment at the top-level of the workspace folder (if you created this _after_ opening VS Code, then run `Reload Window` to pick up the new environment)
  - [ ] Appropriate suffix label specified in status bar (e.g. `(venv)`)
  - [ ] [`Create Terminal`](https://code.visualstudio.com/docs/python/environments#_activating-an-environment-in-the-terminal) works
    - [ ] Steals focus
    - [ ] `"python.terminal.activateEnvironment": false` deactivates automatically running the activation script in the terminal
  - [ ] After the language server downloads it is able to complete its analysis of the environment w/o requiring a restart
- [ ] Detect multiple virtual environments contained in the directory specified in `"python.venvPath"`
- [ ] Detected all [conda environments created with an interpreter](https://code.visualstudio.com/docs/python/environments#_conda-environments)
  - [ ] Appropriate suffix label specified in status bar (e.g. `(condaenv)`)
  - [ ] Prompted to install Pylint
    - [ ] Asked whether to install using conda or pip
    - [ ] Installs into environment
  - [ ] [`Create Terminal`](https://code.visualstudio.com/docs/python/environments#_activating-an-environment-in-the-terminal) works
    - [ ] `"python.terminal.activateEnvironment": false` deactivates automatically running the activation script in the terminal
  - [ ] After the language server downloads it is able to complete its analysis of the environment w/o requiring a restart
- [ ] (Linux/macOS until [`-m` is supported](https://github.com/Microsoft/vscode-python/issues/978)) Detected the virtual environment created by [pipenv](https://docs.pipenv.org/)
  - [ ] Appropriate suffix label specified in status bar (e.g. `(pipenv)`)
  - [ ] Prompt to install Pylint uses `pipenv install --dev`
  - [ ] [`Create Terminal`](https://code.visualstudio.com/docs/python/environments#_activating-an-environment-in-the-terminal) works
    - [ ] `"python.terminal.activateEnvironment": false` deactivates automatically running the activation script in the terminal
  - [ ] After the language server downloads it is able to complete its analysis of the environment w/o requiring a restart
- [ ] (Linux/macOS) Virtual environments created under `{workspaceFolder}/.direnv/python-{python_version}` are detected (for [direnv](https://direnv.net/) and its [`layout python3`](https://github.com/direnv/direnv/blob/master/stdlib.sh) support)
  - [ ] Appropriate suffix label specified in status bar (e.g. `(venv)`)

#### [Environment files](https://code.visualstudio.com/docs/python/environments#_environment-variable-definitions-file)
Sample files:
```python
# example.py
import os
print('Hello,', os.environ.get('WHO'), '!')
```
```
# .env
WHO=world
PYTHONPATH=some/path/somewhere
````

**ALWAYS**:
- Make sure to use `Reload Window` between tests to reset your environment
- Note that environment files only apply under the debugger and Jedi

- [ ] Environment variables in a `.env` file are exposed when running under the debugger
- [ ] `"python.envFile"` allows for specifying an environment file manually (e.g. Jedi picks up `PYTHONPATH` changes)
- [ ] `envFile` in a `launch.json` configuration works

#### [Debugging](https://code.visualstudio.com/docs/python/environments#_python-interpreter-for-debugging)

- [ ] `pythonPath` setting in your `launch.json` overrides your `python.pythonPath` default setting

### [Linting](https://code.visualstudio.com/docs/python/linting)

**ALWAYS**:
- Check under the `Problems` tab to see e.g. if a linter is raising errors

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
  - [ ] Uses `--user` for system-install of Python
  - [ ] Installs into a virtual environment environment directly
- [ ] Pylint works
- [ ] `"python.linting.pylintUseMinimalCheckers": false` turns off the default rules w/ no `pylintrc` file present
- [ ] The existence of a `pylintrc` file turns off the default rules

#### Other linters

**Note**:
- You can use the `Run Linting` command to run a newly installed linter
- When the extension installs a new linter, it turns off all other linters

- [ ] flake8 works
  - [ ] `Select linter` lists the linter and installs it if necessary
- [ ] mypy works
  - [ ] `Select linter` lists the linter and installs it if necessary
- [ ] pep8 works
  - [ ] `Select linter` lists the linter and installs it if necessary
- [ ] prospector works
  - [ ] `Select linter` lists the linter and installs it if necessary
- [ ] pydocstyle works
  - [ ] `Select linter` lists the linter and installs it if necessary
- [ ] pylama works
  - [ ] `Select linter` lists the linter and installs it if necessary
- [ ] 3 or more linters work simultaneously (make sure you have turned on the linters in your `settings.json`)
  - [ ] `Run Linting` runs all activated linters
  - [ ] `"python.linting.enabled": false` disables all linters
  - [ ] The `Enable Linting` command changes `"python.linting.enabled"`
- [ ] `"python.linting.lintOnSave` works

### [Editing](https://code.visualstudio.com/docs/python/editing)

#### [IntelliSense](https://code.visualstudio.com/docs/python/editing#_autocomplete-and-intellisense)

Please also test for general accuracy on the most "interesting" code you can find.

- [ ] `"python.autoComplete.extraPaths"` works
- [ ] `"python.autoComplete.preloadModules"` works (e.g. listing `numpy` should visibly speed up completing on the module's contents)
- [ ] `"python.autocomplete.addBrackets": true` causes auto-completion of functions to append `()`

#### [Formatting](https://code.visualstudio.com/docs/python/editing#_formatting)
Sample file:
```python
# There should be _some_ change after running `Format Document`.
def foo():pass
```

- [ ] Prompted to install a formatter if none installed and `Format Document` is run
  - [ ] Installing `autopep8` works
  - [ ] Installing `black` works
  - [ ] Installing `yapf` works
- [ ] autopep8 works
- [ ] black works
- [ ] yapf works
- [ ] `"editor.formatOnType": true` works and has expected results

#### [Refactoring](https://code.visualstudio.com/docs/python/editing#_refactoring)

- [ ] [`Extract Variable`](https://code.visualstudio.com/docs/python/editing#_extract-variable) works
  - [ ] You are prompted to install `rope` if it is not already available
- [ ] [`Extract method`](https://code.visualstudio.com/docs/python/editing#_extract-method) works
  - [ ] You are prompted to install `rope` if it is not already available
- [ ] [`Sort Imports`](https://code.visualstudio.com/docs/python/editing#_sort-imports) works

### [Debugging](https://code.visualstudio.com/docs/python/debugging)

**ALWAYS**:
- Test the current debugger
- Test the experimental debugger (and note whether it is _at least_ as fast as the old debugger)

- [ ] [Configurations](https://code.visualstudio.com/docs/python/debugging#_debugging-specific-app-types) work (see [`package.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json) and the `"configurationSnippets"` section for all of the possible configurations)
- [ ] Running code from start to finish w/ no special debugging options (e.g. no breakpoints)
- [ ] Breakpoint-like things
  - [ ] Breakpoint
    - [ ] Set
    - [ ] Hit
  - [ ] Conditional breakpoint
    - [ ] Expression
      - [ ] Set
      - [ ] Hit
    - [ ] Hit count
      - [ ] Set
      - [ ] Hit
  - [ ] Logpoint
    - [ ] Set
    - [ ] Hit
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
  - [ ] Code lens for a class runs all tests for that class
  - [ ] Code lens for a method runs just that test
    - [ ] `Run Test` works
    - [ ] `Debug Test` works

#### [`pytest`](https://code.visualstudio.com/docs/python/unit-testing#_pytest-configuration-settings)
```python
def test_passing():
    assert 42 == 42

def test_failure():
    assert 42 == -13
```

- [ ] `Run All Unit Tests` triggers the prompt to configure the test runner
  - [ ] `pytest` gets installed
- [ ] Tests are discovered (as shown by code lenses on each test)
  - [ ] `Run Test` works
  - [ ] `Debug Test` works

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
  - [ ] `Run Test` works
  - [ ] `Debug Test` works

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

</details>
