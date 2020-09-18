# Test plan

## Environment

-   OS: XXX (Windows, macOS, latest Ubuntu LTS)
    -   Shell: XXX (Command Prompt, PowerShell, bash, fish)
-   Python
    -   Distribution: XXX (CPython, miniconda)
    -   Version: XXX (2.7, latest 3.x)
-   VS Code: XXX (Insiders)

## Tests

**ALWAYS**:

-   Check the `Output` window under `Python` for logged errors
-   Have `Developer Tools` open to detect any errors
-   Consider running the tests in a multi-folder workspace
-   Focus on in-development features (i.e. experimental debugger and language server)

<details>
  <summary>Scenarios</summary>

### [Environment](https://code.visualstudio.com/docs/python/environments)

#### Interpreters

-   [ ] Interpreter is [shown in the status bar](https://code.visualstudio.com/docs/python/environments#_choosing-an-environment)
-   [ ] An interpreter can be manually specified using the [`Select Interpreter` command](https://code.visualstudio.com/docs/python/environments#_choosing-an-environment)
-   [ ] Detected system-installed interpreters
-   [ ] Detected an Anaconda installation
-   [ ] (Linux/macOS) Detected all interpreters installed w/ [pyenv](https://github.com/pyenv/pyenv) detected
-   [ ] [`"python.pythonPath"`](https://code.visualstudio.com/docs/python/environments#_manually-specifying-an-interpreter) triggers an update in the status bar
-   [ ] `Run Python File in Terminal`
-   [ ] `Run Selection/Line in Python Terminal`
    -   [ ] Right-click
    -   [ ] Command
    -   [ ] `Shift+Enter`

#### Terminal

Sample file:

```python
import requests
request = requests.get("https://drive.google.com/uc?export=download&id=1_9On2-nsBQIw3JiY43sWbrF8EjrqrR4U")
with open("survey2017.zip", "wb") as file:
    file.write(request.content)
import zipfile
with zipfile.ZipFile('survey2017.zip') as zip:
    zip.extractall('survey2017')
import shutil, os
shutil.move('survey2017/survey_results_public.csv','survey2017.csv')
shutil.rmtree('survey2017')
os.remove('survey2017.zip')
```

-   [ ] _Shift+Enter_ to send selected code in sample file to terminal works

#### Virtual environments

**ALWAYS**:

-   Use the latest version of Anaconda
-   Realize that `conda` is slow
-   Create an environment with a space in their path somewhere as well as upper and lowercase characters
-   Make sure that you do not have `python.pythonPath` specified in your `settings.json` when testing automatic detection
-   Do note that the `Select Interpreter` drop-down window scrolls

-   [ ] Detected a single virtual environment at the top-level of the workspace folder on Mac when when `python` command points to default Mac Python installation or `python` command fails in the terminal.
    -   [ ] Appropriate suffix label specified in status bar (e.g. `(venv)`)
-   [ ] Detected a single virtual environment at the top-level of the workspace folder on Windows when `python` fails in the terminal.
    -   [ ] Appropriate suffix label specified in status bar (e.g. `(venv)`)
-   [ ] Detected a single virtual environment at the top-level of the workspace folder
    -   [ ] Appropriate suffix label specified in status bar (e.g. `(venv)`)
    -   [ ] [`Create Terminal`](https://code.visualstudio.com/docs/python/environments#_activating-an-environment-in-the-terminal) works
        -   [ ] Steals focus
        -   [ ] `"python.terminal.activateEnvironment": false` deactivates automatically running the activation script in the terminal
    -   [ ] After the language server downloads it is able to complete its analysis of the environment w/o requiring a restart
-   [ ] Detect multiple virtual environments contained in the directory specified in `"python.venvPath"`
-   [ ] Detected all [conda environments created with an interpreter](https://code.visualstudio.com/docs/python/environments#_conda-environments)
    -   [ ] Appropriate suffix label specified in status bar (e.g. `(condaenv)`)
    -   [ ] Prompted to install Pylint
        -   [ ] Asked whether to install using conda or pip
        -   [ ] Installs into environment
    -   [ ] [`Create Terminal`](https://code.visualstudio.com/docs/python/environments#_activating-an-environment-in-the-terminal) works
        -   [ ] `"python.terminal.activateEnvironment": false` deactivates automatically running the activation script in the terminal
    -   [ ] After the language server downloads it is able to complete its analysis of the environment w/o requiring a restart
-   [ ] (Linux/macOS until [`-m` is supported](https://github.com/Microsoft/vscode-python/issues/978)) Detected the virtual environment created by [pipenv](https://docs.pipenv.org/)
    -   [ ] Appropriate suffix label specified in status bar (e.g. `(pipenv)`)
    -   [ ] Prompt to install Pylint uses `pipenv install --dev`
    -   [ ] [`Create Terminal`](https://code.visualstudio.com/docs/python/environments#_activating-an-environment-in-the-terminal) works
        -   [ ] `"python.terminal.activateEnvironment": false` deactivates automatically running the activation script in the terminal
    -   [ ] After the language server downloads it is able to complete its analysis of the environment w/o requiring a restart
-   [ ] (Linux/macOS) Virtual environments created under `{workspaceFolder}/.direnv/python-{python_version}` are detected (for [direnv](https://direnv.net/) and its [`layout python3`](https://github.com/direnv/direnv/blob/master/stdlib.sh) support)
    -   [ ] Appropriate suffix label specified in status bar (e.g. `(venv)`)

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
SPAM='hello ${WHO}'
```

**ALWAYS**:

-   Make sure to use `Reload Window` between tests to reset your environment
-   Note that environment files only apply under the debugger and Jedi

-   [ ] Environment variables in a `.env` file are exposed when running under the debugger
-   [ ] `"python.envFile"` allows for specifying an environment file manually (e.g. Jedi picks up `PYTHONPATH` changes)
-   [ ] `envFile` in a `launch.json` configuration works
-   [ ] simple variable substitution works

#### [Debugging](https://code.visualstudio.com/docs/python/environments#_python-interpreter-for-debugging)

-   [ ] `pythonPath` setting in your `launch.json` overrides your `python.pythonPath` default setting

### [Linting](https://code.visualstudio.com/docs/python/linting)

**ALWAYS**:

-   Check under the `Problems` tab to see e.g. if a linter is raising errors

#### Language server

-   [ ] LS is downloaded using HTTP (no SSL) when the "http.proxyStrictSSL" setting is false
-   [ ] An item with a cloud icon appears in the status bar indicating progress while downloading the language server
-   [ ] Installing [`requests`](https://pypi.org/project/requests/) in virtual environment is detected
    -   [ ] Import of `requests` without package installed is flagged as unresolved
    -   [ ] Create a virtual environment
    -   [ ] Install `requests` into the virtual environment

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
foo = 42  # Marked as a disallowed name.
```

-   [ ] Installation via the prompt installs Pylint as appropriate
    -   [ ] Uses `--user` for system-install of Python
    -   [ ] Installs into a virtual environment environment directly
-   [ ] Pylint works
-   [ ] `"python.linting.pylintUseMinimalCheckers": false` turns off the default rules w/ no `pylintrc` file present
-   [ ] The existence of a `pylintrc` file turns off the default rules

#### Other linters

**Note**:

-   You can use the `Run Linting` command to run a newly installed linter
-   When the extension installs a new linter, it turns off all other linters

-   [ ] flake8 works
    -   [ ] `Select linter` lists the linter and installs it if necessary
-   [ ] mypy works
    -   [ ] `Select linter` lists the linter and installs it if necessary
-   [ ] pycodestyle works
    -   [ ] `Select linter` lists the linter and installs it if necessary
-   [ ] prospector works
    -   [ ] `Select linter` lists the linter and installs it if necessary
-   [ ] pydocstyle works
    -   [ ] `Select linter` lists the linter and installs it if necessary
-   [ ] pylama works
    -   [ ] `Select linter` lists the linter and installs it if necessary
-   [ ] 3 or more linters work simultaneously (make sure you have turned on the linters in your `settings.json`)
    -   [ ] `Run Linting` runs all activated linters
    -   [ ] `"python.linting.enabled": false` disables all linters
    -   [ ] The `Enable Linting` command changes `"python.linting.enabled"`
-   [ ] `"python.linting.lintOnSave` works

### [Editing](https://code.visualstudio.com/docs/python/editing)

#### [IntelliSense](https://code.visualstudio.com/docs/python/editing#_autocomplete-and-intellisense)

Please also test for general accuracy on the most "interesting" code you can find.

-   [ ] `"python.autoComplete.extraPaths"` works
-   [ ] `"python.autocomplete.addBrackets": true` causes auto-completion of functions to append `()`
-   [ ] Auto-completions works

#### [Formatting](https://code.visualstudio.com/docs/python/editing#_formatting)

Sample file:

```python
# There should be _some_ change after running `Format Document`.
import os,sys;
def foo():pass
```

-   [ ] Prompted to install a formatter if none installed and `Format Document` is run
    -   [ ] Installing `autopep8` works
    -   [ ] Installing `black` works
    -   [ ] Installing `yapf` works
-   [ ] Formatters work with default settings (i.e. `"python.formatting.provider"` is specified but not matching `*Path`or `*Args` settings)
    -   [ ] autopep8
    -   [ ] black
    -   [ ] yapf
-   [ ] Formatters work when appropriate `*Path` and `*Args` settings are specified (use absolute paths; use `~` if possible)
    -   [ ] autopep8
    -   [ ] black
    -   [ ] yapf
-   [ ] `"editor.formatOnType": true` works and has expected results

#### [Refactoring](https://code.visualstudio.com/docs/python/editing#_refactoring)

-   [ ] [`Extract Variable`](https://code.visualstudio.com/docs/python/editing#_extract-variable) works
    -   [ ] You are prompted to install `rope` if it is not already available
-   [ ] [`Extract method`](https://code.visualstudio.com/docs/python/editing#_extract-method) works
    -   [ ] You are prompted to install `rope` if it is not already available
-   [ ] [`Sort Imports`](https://code.visualstudio.com/docs/python/editing#_sort-imports) works

### [Debugging](https://code.visualstudio.com/docs/python/debugging)

-   [ ] [Configurations](https://code.visualstudio.com/docs/python/debugging#_debugging-specific-app-types) work (see [`package.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) and the `"configurationSnippets"` section for all of the possible configurations)
-   [ ] Running code from start to finish w/ no special debugging options (e.g. no breakpoints)
-   [ ] Breakpoint-like things
    -   [ ] Breakpoint
        -   [ ] Set
        -   [ ] Hit
    -   [ ] Conditional breakpoint
        -   [ ] Expression
            -   [ ] Set
            -   [ ] Hit
        -   [ ] Hit count
            -   [ ] Set
            -   [ ] Hit
    -   [ ] Logpoint
        -   [ ] Set
        -   [ ] Hit
-   [ ] Stepping
    -   [ ] Over
    -   [ ] Into
    -   [ ] Out
-   [ ] Can inspect variables
    -   [ ] Through hovering over variable in code
    -   [ ] `Variables` section of debugger sidebar
-   [ ] [Remote debugging](https://code.visualstudio.com/docs/python/debugging#_remote-debugging) works
    -   [ ] ... over SSH
    -   [ ] ... on other branches
-   [ ] [App Engine](https://code.visualstudio.com/docs/python/debugging#_google-app-engine-debugging)

### [Unit testing](https://code.visualstudio.com/docs/python/unit-testing)

#### [`unittest`](https://code.visualstudio.com/docs/python/unit-testing#_unittest-configuration-settings)

```python
import unittest

MODULE_SETUP = False


def setUpModule():
    global MODULE_SETUP
    MODULE_SETUP = True


class PassingSetupTests(unittest.TestCase):
    CLASS_SETUP = False
    METHOD_SETUP = False

    @classmethod
    def setUpClass(cls):
        cls.CLASS_SETUP = True

    def setUp(self):
        self.METHOD_SETUP = True

    def test_setup(self):
        self.assertTrue(MODULE_SETUP)
        self.assertTrue(self.CLASS_SETUP)
        self.assertTrue(self.METHOD_SETUP)


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

-   [ ] `Run All Unit Tests` triggers the prompt to configure the test runner
-   [ ] Tests are discovered (as shown by code lenses on each test)
    -   [ ] Code lens for a class runs all tests for that class
    -   [ ] Code lens for a method runs just that test
        -   [ ] `Run Test` works
        -   [ ] `Debug Test` works
        -   [ ] Module/suite setup methods are also run (run the `test_setup` method to verify)
-   [ ] while debugging tests, an uncaught exception in a test does not
        cause `debugpy` to raise `SystemExit` exception.

#### [`pytest`](https://code.visualstudio.com/docs/python/unit-testing#_pytest-configuration-settings)

```python
def test_passing():
    assert 42 == 42

def test_failure():
    assert 42 == -13
```

-   [ ] `Run All Unit Tests` triggers the prompt to configure the test runner
    -   [ ] `pytest` gets installed
-   [ ] Tests are discovered (as shown by code lenses on each test)
    -   [ ] `Run Test` works
    -   [ ] `Debug Test` works
-   [ ] A `Diagnostic` is shown in the problems pane for each failed/skipped test
    -   [ ] The `Diagnostic`s are organized according to the file the test was executed from (not necessarily the file it was defined in)
    -   [ ] The appropriate `DiagnosticRelatedInformation` is shown for each `Diagnostic`
    -   [ ] The `DiagnosticRelatedInformation` reflects the traceback for the test

#### [`nose`](https://code.visualstudio.com/docs/python/unit-testing#_nose-configuration-settings)

```python
def test_passing():
    assert 42 == 42

def test_failure():
    assert 42 == -13
```

-   [ ] `Run All Unit Tests` triggers the prompt to configure the test runner
    -   [ ] Nose gets installed
-   [ ] Tests are discovered (as shown by code lenses on each test)
    -   [ ] `Run Test` works
    -   [ ] `Debug Test` works

#### General

-   [ ] Code lenses appears
    -   [ ] `Run Test` lens works (and status bar updates as appropriate)
    -   [ ] `Debug Test` lens works
    -   [ ] Appropriate ✔/❌ shown for each test
-   [ ] Status bar is functioning
    -   [ ] Appropriate test results displayed
    -   [ ] `Run All Unit Tests` works
    -   [ ] `Discover Unit Tests` works (resets tests result display in status bar)
    -   [ ] `Run Unit Test Method ...` works
    -   [ ] `View Unit Test Output` works
    -   [ ] After having at least one failure, `Run Failed Tests` works
-   [ ] `Configure Unit Tests` works
    -   [ ] quick pick for framework (and its settings)
    -   [ ] selected framework enabled in workspace settings
    -   [ ] framework's config added (and old config removed)
    -   [ ] other frameworks disabled in workspace settings
-   [ ] `Configure Unit Tests` does not close if it loses focus
-   [ ] Cancelling configuration does not leave incomplete settings
-   [ ] The first `"request": "test"` entry in launch.json is used for running unit tests

### [Data Science](https://code.visualstudio.com/docs/python/jupyter-support)

#### P0 Test Scenarios

-   [ ] Start and connect to local Jupyter server
    1. Open the file src/test/datascience/manualTestFiles/manualTestFile.py in VSCode
    1. At the top of the file it will list the things that you need installed in your Python environment
    1. On the first cell click `Run Below`
    1. Interactive Window should open, show connection information, and execute cells
    1. The first thing in the window should have a line like this: `Jupyter Server URI: http://localhost:[port number]/?token=[token value]`
-   [ ] Verify Basic Notebook Editor
    1. Create a new file in VS code with the extension .ipynb
    1. Open the file
    1. The Notebook Editor should open
    1. Verify that there is a single cell in the notebook editor
    1. Add `print('bar')` to that cell
    1. Run the cell
    1. Verify that `bar` shows up below the input
    1. Add a cell with the topmost hover bar
    1. Verify the cell appears above all others
    1. Add a cell at the bottom with the bottom most hover bar
    1. Verify the cell appears below all cells
    1. Select a cell
    1. Add a cell with the plus button on the cell
    1. Verify cell appears below
    1. Repeat with the topmost toolbar
-   [ ] Verify basic outputs
    1. Run all the cells in manualTestFile.py
    1. Check to make sure that no outputs have errors
    1. Verify that graphs and progress bars are shown
-   [ ] Verify export / import
    1. With the results from `Start and connect to local server` open click the `Export as Jupyter Notebook` button in the Interactive Window
    1. Choose a file location and save the generated .ipynb file
    1. When the prompt comes up in the lower right choose to open the file in the browser
    1. The file should open in the web browser and contain the output from the Interactive Window
    1. Try the same steps and choose to open the file in the ipynb editor.
    1. The file should open in the Notebook Editor.
-   [ ] Verify text entry
    1. In the Interactive Window type in some new code `print('testing')` and submit it to the Interactive Windows
    1. Verify the output from what you added
-   [ ] Verify dark and light main themes
    1. Repeat the `Start and connect to local server` and `Verify basic outputs` steps using `Default Dark+` and `Default Light+` themes
-   [ ] Verify Variable Explorer
    1. After manualTestFile.py has been run drop down the Variables section at the top of the Interactive Window
    1. In the Variables list there should be an entry for all variables created. These variables might change as more is added to manualTestFile.py.
    1. Check that variables have expected values. They will be truncated for longer items
    1. Sort the list ascending and descending by Type. Also sort the list ascending and descending by Count. Values like (X, Y) use the first X value for Count sort ordering
    1. Check that list, Series, ndarray, and DataFrame types have a button to "Show variable in data viewer" on the right
    1. In the Interactive Window input box add a new variable. Verify that it is added into the Variable Explorer
    1. Export the contents of the interactive window as a notebook and open the notebook editor
    1. Find the first cell and click on the Run Below button
    1. Open the variable explorer and verify the same variables are there
    1. Add a new cell with a variable in it.
    1. Run the cell and verify the variable shows up in the variable explorer
-   [ ] Verify Data Explorer
    1. From the listed types in the Variable explorer open up the Data Viewer by clicking the button or double clicking the row
    1. Inspect the data in the Data Viewer for the expected values
       [ ] Verify Sorting and Filtering
        1. Open up the myDataFrame item
        1. Sort the name column ascending and descending
        1. Sort one of the numerical columns ascending and descending
        1. Click the Filter Rows button
        1. In the name filter box input 'a' to filter to just name with an a in them
        1. In one of the numerical columns input a number 1 - 9 to filter to just that column
    1. Open the myList variable in the explorer
    1. Make sure that you can scroll all the way to the end of the entries
       [ ] Verify notebook outputs
    1. Open the src/test/datascience/manualTestFiles/manualTestFile.py in VSCode.
    1. Run all of the cells in the file.
    1. Interactive Window should open
    1. Export the cells in the interactive window and open the notebook editor
    1. Run all the cells in the notebook editor and verify the same outputs appear as in the interactive window
-   [ ] Verify Notebook Editor Intellisense
    1. Open the src/test/datascience/manualTestFiles/manualTestFile.py in VSCode.
    1. Run all of the cells in the file.
    1. Interactive Window should open
    1. Export the cells in the interactive window and open the notebook editor
    1. Hover over each cell in the notebook editor and verify you get hover intellisense
    1. Add a new cell in between cells
    1. Add `import sys` and `sys.executable` to the cell
    1. Move the cell around and verify intellisense hover still works on the `import sys`
    1. Delete and readd the cell and verify intellisense hover still works.
-   [ ] Verify Notebook Keyboard Shortcuts
    1. Using the notebook generated from the manualTestFile.py, do the following
    1. Select a cell by clicking on it
    1. Move selection up and down with j,k and arrow keys.
    1. Focus a cell by double clicking on it or hitting the enter key when selected
    1. Move selection through the code with the arrow keys.
    1. Verify selection travels between focused cells
    1. Hit escape when a cell has focus and verify it becomes selected instead of focused
    1. Hit `y` on a markdown cell when not focused and see that it becomes a code cell
    1. Hit `m` on a code cell when not focused and see that it becomes a markdown cell
    1. Hit `l` on a code cell and verify line numbers appear
    1. Hit `o` on a code cell with output and verify that outputs disappear
    1. Hit `d` + `d` and verify a cell is deleted.
    1. Hit `z` and verify a deleted cell reappears
    1. Hit `a` and verify the selected cell moves up
    1. Hit `b` and verify the selected cell moves down
    1. Hit `shift+enter` and verify a cell runs and selection moves to the next cell
    1. Hit `alt+enter` and verify a cell runs and a new cell is added below
    1. Hit `ctrl+enter` and verify a cell runs and selection does not change
-   [ ] Verify debugging
    1. Open the file src/test/datascience/manualTestFiles/manualTestFile.py in VSCode
    1. On the first cell click `Run Below`
    1. Interactive Window should open, show connection information, and execute cells
    1. Go back to the first cell and click `Debug Cell`
    1. Debugger should start and have an ip indicator on the first line of the cell
    1. Step through the debugger.
    1. Verify the variables tab of the debugger shows variables.
    1. Verify the variables explorer window shows output not available while debugging
    1. When you get to the end of the cell, the debugger should stop
    1. Output from the cell should show up in the Interactive Window (sometimes you have to finish debugging the cell first)
-   [ ] Verify installing ipykernel in a new environment
    1. Create a brand new folder on your machine
    1. Create a new venv in that folder via command line / terminal `python3 -m venv .newEnv`
    1. Open that folder in VS Code and copy the manual test file there
    1. Select the newly created venv by running Ctrl+Shift+P, typing 'Python: Select Interpreter' into the VS Code command palette, and selecting the new venv from the dropdown. If the new venv doesn't appear in the quickpick you may need to reload VS Code and reattempt this step.
    1. Execute the manual test file, you should be prompted to install ipykernel in `.newEnv`
    1. After ipykernel is installed execution of the file should continue successfully

#### P1 Test Scenarios

-   [ ] Connect to a `remote` server
    1. Open up a valid python command prompt that can run `jupyter notebook` (a default Anaconda prompt works well)
    1. Run `jupyter notebook` to start up a local Jupyter server
    1. In the command window that launched Jupyter look for the server / token name like so: http://localhost:8888/?token=bf9eae43641cd75015df9104f814b8763ef0e23ffc73720d
    1. Run the command `Python: Select Jupyter server URI` then `Type in the URI to connect to a running jupyter server`
    1. Input the server / token name here
    1. Now run the cells in the manualTestFile.py
    1. Verify that you see the server name in the initial connection message
    1. Verify the outputs of the cells
-   [ ] Interactive Window commands
    -   [ ] Verify per-cell commands
        1. Expand and collapse the input area of a cell
        1. Use the `X` button to remove a cell
        1. Use the `Goto Code` button to jump to the part of the .py file that submitted the code
    -   [ ] Verify top menu commands
        1. Use `X` to delete all cells
        1. Undo the delete action with `Undo`
        1. Redo the delete action with `Redo`
        1. In manualTestFile.py modify the trange command in the progress bar from 100 to 2000. Run the Cell. As the cell is running hit the `Interrupt iPython Kernel` button
        1. The progress bar should be interrupted and you should see a KeyboardInterrupt error message in the output
        1. Test the `Restart iPython kernel` command. Kernel should be restarted and you should see a status output message for the kernel restart
        1. Use the expand all input and collapse all input commands to collapse all cell inputs
-   [ ] Verify theming works
    1. Start Python Interactive window
    1. Add a cell with some comments
    1. Switch VS Code theme to something else
    1. Check that the cell you just added updates the comment color
    1. Switch back and forth between a 'light' and a 'dark' theme
    1. Check that the cell switches colors
    1. Check that the buttons on the top change to their appropriate 'light' or 'dark' versions
    1. Enable the 'ignoreVscodeTheme' setting
    1. Close the Python Interactive window and reopen it. The theme in just the 'Python Interactive' window should be light
    1. Switch to a dark theme. Make sure the interactive window remains in the light theme.
-   [ ] Verify code lenses
    1. Check that `Run Cell` `Run Above` and `Run Below` all do the correct thing
-   [ ] Verify context menu navigation commands
    1. Check the `Run Current Cell` and `Run Current Cell And Advance` context menu commands
    1. If run on the last cell of the file `Run Current Cell And Advance` should create a new empty cell and advance to it
-   [ ] Verify command palette commands
    1. Close the Interactive Window then pick `Python: Show Interactive Window`
    1. Restart the kernel and pick `Python: Run Current File In Python Interactive Window` it should run the whole file again
-   [ ] Verify shift-enter
    1. Move to the top cell in the .py file
    1. Shift-enter should run each cell and advance to the next
    1. Shift-enter on the final cell should create a new cell and move to it
-   [ ] Verify file without cells
    1. Open the manualTestFileNoCells.py file
    1. Select a chunk of code, shift-enter should send it to the terminal
    1. Open VSCode settings, change `Send Selection To Interactive Window` to true
    1. Select a chunk of code, shift-enter should send that selection to the Interactive Windows
    1. Move your cursor to a line, but don't select anything. Shift-enter should send that line to the Interactive Window
-   [ ] Multiple installs
    1. Close and re-open VSCode to make sure that all jupyter servers are closed
    1. Also make sure you are set to locally launch Jupyter and not to connect to an existing URI
    1. In addition to your main testing environment install a new python or miniconda install (conda won't work as it has Jupyter by default)
    1. In VS code change the python interpreter to the new install
    1. Try `Run Cell`
    1. You should get a message that Jupyter was not found and that it is defaulting back to launch on the python instance that has Jupyter
-   [ ] LiveShare Support
    1. Install the LiveShare VSCode Extension
    1. Open manualTestFile.py in VSCode
    1. Run the first cell in the file
    1. Switch to the `Live Share` tab in VS Code and start a session
        - [ ] Verify server start
            1. Jupyter server instance should appear in the live share tab
    1. Open another window of VSCode
    1. Connect the second instance of VSCode as a Guest to the first Live Share session
    1. After the workspace opens, open the manualTestFile.py on the Guest instance
    1. On the Guest instance run a cell from the file, both via the codelens and via the command palette `Run Cell` command
        - [ ] Verify results
            1. Output should show up on the Guest Interactive Window
            1. Same output should show up in the Host Interactive Window
    1. On the Host instance run a cell from the file, both via the codelens and via the command palette
        - [ ] Verify results
            1. Output should show up on the Guest Interactive Window
            1. Same output should show up in the Host Interactive Window
    1. Export the file to a notebook
    1. Open the notebook editor on the host
    1. Run a cell on the host
    1. Verify the editor opens on the guest and the cell is run there too
-   [ ] Jupyter Hub support

    1. Windows install instructions

        1. Install Docker Desktop onto a machine
        1. Create a folder with a file 'Dockerfile' in it.
        1. Mark the file to look like so:

        ```
        ARG BASE_CONTAINER=jupyterhub/jupyterhub
        FROM $BASE_CONTAINER

        USER root

        USER $NB_UID
        ```

        1. From a command prompt (in the same folder as the Dockerfile), run `docker build -t jupyterhubcontainer:1.0 .`
        1. Run `docker container create --name jupyterhub jupyterhubcontainer:1.0 jupyterhub`
        1. From the docker desktop app, start the jupyterhub container.
        1. From the docker desktop app, run the CLI

    1. OR Mac / Linux install instructions
        1. Install docker
        1. From the terminal `docker run -p 8000:8000 -d --name jupyterhub jupyterhub/jupyterhub jupyterhub`
        1. Open a terminal in the docker container with `docker exec -it jupyterhub bash`
        1. From that terminal run `python3 -m pip install notebook`
    1. From the new command prompt, run `adduser testuser`
    1. Follow the series of prompts to add a password for this user
    1. Open VS code
    1. Open a folder with a python file in it.
    1. Run the `Python: Specify local or remote Jupyter server for connections` command.
    1. Pick 'Existing'
    1. Enter `http://localhost:8000` (assuming the jupyter hub container was successful in launching)
    1. Reload VS code and reopen this folder.
    1. Run a cell in a python file.
       [ ] Verify results 1. Verify you are asked first for a user name and then a password. 1. Verify a cell runs once you enter the user name and password 1. Verify that the python that is running in the interactive window is from the docker container (if on windows it should show a linux path)

#### P2 Test Scenarios

-   [ ] Directory change
    -   [ ] Verify directory change in export
        1. Follow the previous steps for export, but export the ipynb to a directory outside of the current workspace
        1. Open the file in the browser, you should get an initial cell added to change directory back to your workspace directory
    -   [ ] Verify directory change in import
        1. Follow the previous steps for import, but import an ipynb that is located outside of your current workspace
        1. Open the file in the editor. There should be python code at the start to change directory to the previous location of the .ipynb file
-   [ ] Interactive Window input history history
    1. Start up an Interactive Window session
    1. Input several lines into the Interactive Window terminal
    1. Press up to verify that those previously entered lines show in the Interactive Window terminal history
-   [ ] Extra themes 1. Try several of the themes that come with VSCode that are not the default Dark+ and Light+
</details>
