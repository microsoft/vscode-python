# UI driven BDD Tests for Python Extension.

## Usage

Assuming you have created a virtual environment (for Python 3.7),
installed the `uitests/requirements.txt` dependencies, and activated the virtual environment:

```shell
$ # This step `npm run package` is required to ensure the 'ms-python-insiders.vsix' is available locally.
$ # You could instead just download this and dump into the working directory (much faster).
$ npm run package # see notes above.


$ python uitests download
$ python uitests install
$ python uitests test # Use the `-- --tags=@xyz` argument to run specific tests.
$ python uitests --help # for more information.
```

## Overview

-   These are a set of UI tests for the Python Extension in VSC.
-   The UI is driven using the [selenium webdriver](https://selenium-python.readthedocs.io/).
-   [BDD](https://docs.cucumber.io/bdd/overview/) is used to create the tests, and executed using [Behave](https://behave.readthedocs.io/en/latest/).

## How does it work?

Here are the steps involved in running the tests:

* Setup environment:
    -   Download a completely fresh version of VS Code (`stable/insiders`. Defaults to `stable`).
    -   Download [ChromeDriver](http://chromedriver.chromium.org/) corresponding to the version of [Electron](https://electronjs.org/) upon which VS Code is built.
        -   WARNING: When testing against VSC Insiders, it was found that chromedriver for electron 4.2.3 didn't work, and we had to revert to the version used in electron found in stable VSC.
        -   Currently when testing against VSC insiders, we use the same version of chromedriver used for VSC Stable. (due to a known issue in `ChromeDriver`)
    -   Use [selenium webdriver](https://selenium-python.readthedocs.io/) to drive the VSC UI.
    -   Create a folder named `.vsccode test` where test specific files will be created (reports, logs, VS Code, etc).

*   When launching VSC, we will launch it as a completely stand alone version of VSC.
    -   I.e. even if it is installed on the current machine, we'll download and launch a new instance.
    -   This new instance will not interfere with currently installed version of VSC.
    -   All user settings, etc will be in a separate directory (see `user` folder).
    -   VSC will not have any extensions (see `extensions` folder).
*   Automate VSC UI
    -   Launch VSC using the [ChromeDriver](http://chromedriver.chromium.org/)
    -   Use [selenium webdriver](https://selenium-python.readthedocs.io/) to drive the VSC UI.
    -   The [BDD](https://docs.cucumber.io/bdd/overview/) tests are written and executed using [Behave](https://behave.readthedocs.io/en/latest/).
*   Workspace folder/files
    -   Each [feature](https://docs.cucumber.io/gherkin/reference/#feature) can have its own set of files in the form of a github repo.
    -   Just add a tag with the path of the github repo url to the `feature`.
    -   When starting the tests for a feature, the repo is downloaded into a new random directory `.vscode test/temp/workspace folder xyz`
    -   At the beginning of every scenario, we repeate the previous step.
    -   This ensures each scenario starts with a clean workspace folder.
*   Reports
    -   Test results are stored in the `reports` directory
    -   These `json` (`cucumber format`) report files are converted into HTML using an `npm` script [cucumber-html-reporter](https://www.npmjs.com/package/cucumber-html-reporter).
    -   For each `scenario` that's executed, we create a corresponding directory in `reports` directory.
        -   This will contain all screenshots realted to that scenario.
        -   If the scenario fails, all logs, workspace folder are copied into this directory.
        -   Thus, when ever a test fails, we have everything related to that test.
        -   If the scenario passes, this directory is deleted (we don't need them on CI server).

## Technology

*   99% of the code is written in `Python`.
*   Downloading of `chrome driver` and generating `html reports` is done in `node.js` (using pre-existing `npm` packages).
*   The tests are written using [Behave](https://behave.readthedocs.io/en/latest/) in `Python`.
*   `GitHub` repos are used to provide the files to be used for testing in a workspace folder.
*   The reports (`cucumber format`) are converted into HTML using an `npm` script [cucumber-html-reporter](https://www.npmjs.com/package/cucumber-html-reporter).
*   Test result reports are generated using `junit` format, for Azure Devops.

## Caveats

*   VSC UI needs be a top level window for elements to receive focus. Hence when running tests, try not do anything else.
*   For each test we create a whole new folder and open that in VS Code:
    -   We could use `git reset`, however on Windows, this is flaky if VSC is open.
    -   Deleting files on `Windows` is flaky due to files being in use, etc.
    -   Majority of the issues are around `fs` on `windows`
    -   The easies fix for all of this is simple
    -   create new folders for every test.
*   `chromedriver` only supports arguments that begin with `--`. Hence arguments passed to VSC are limited to those that start with `--`.
*   `Terminal` output cannot be retrieved using the `driver`. Hence output from terminal cannot be inspected.
    -   Perhaps thi sis possible, but at the time of writinng this I couldn't find a solution.
    -   I believe the `Terminal` in VSC is `SVG` based, hence reading text is out of the question.
    -   (This is made possible by writing the command to be executed into `commands.txt`, and letting the bootstrap extension read that file and run the command in the terminal using the VSC API).
*   Sending characters to an input is slow, the `selenium` send text one character at a time. Hence tests are slow.
*   Sending text to an editor can be flaky.
    -   Assume we would like to `type` some code into a VSC editor.
    -   As `selenium` sends a character at a time, VSC kicks in and attempts to format/autocomplete code and the like. This interferes with the code being typed out.
    -   Solution: Copy code into clipboard, then pase into editor.
*   `Behave` does not generate any HTML reports
    -   Solution, we generate `cucumber` compliant `json` report. Hence the custom formatter in `report.py`.
    -   Using a `cucumber json` report format allows us to use existing tools to generate other HTML reports out of the raw `json` files.
*   Sending keyboard commands to VSC (such as `ctrl+p`) is currently not possible (**not known how to**).
    -   `Selenium driver` can only send keyboard commands to a specific `html element`.
    -   But keyboard commands such as `ctrl+p` are to be sent to the main window, and this isn't possible/not known.
        -   Solution: We need to find the `html element` in VSC that will accept keys such as `ctrl+p` and the like.
    -   Fortunately almost everything in VSC can be driven through commands in the `command palette`.
        -   Hence, we have an extension that opens the `command palette`, from there, we use `selenium driver` to select commands.
        -   This same extension is used to `activate` the `Python extension`.
        -   This extension is referred to as the `bootstrap extension`.
*   When updating settings in VSC, do not alter the settings files directly. VSC could take a while to detect file changes and load the settings.
    -   An even better way, is to use the VSC api to update the settings (via the bootstrap API) or edit the settings file directly through the UI.
    -   Updating settings through the editor (by editing the `settings.json` file directly is not easy, as its not easy to update/remove settings).
    -   Using the API we can easily determine when VSC is aware of the changes (basically when API completes, VSC is aware of the new settings).
    -   (This is made possible by writing the settings to be updated into `settingsToUpdate.txt`, and letting the bootstrap extension read that file and update the VSC settings using the VSC API).

## Files & Folders

*   The folder `.vsccode-test` in the root directory is where VSC is downloaded, workspace files created, etc.
    -   `stable` This is VS Code stable is downloaded (corresponding version of `chromedriver` is also downloaded and stored in this same place).
    -   `insider` This is VS Code insider is downloaded (corresponding version of `chromedriver` is also downloaded and stored in this same place).
    -   `user` Directory VS Code uses to store user information (settings, etc)
    -   `extensions` This is where the extensions get installed for the instance of VSC used for testing.
    -   `workspace folder` Folder opened in VS Code for testing
    -   `temp` Temporary directory for testing. (sometimes tests will create folders named `workspace folder xyz` to be used as workspace folders used for testing)
    -   `reports` Location where generated reports are stored.
    -   `logs` Logs for tests
    -   `screenshots` Screen shots captured during tests
-   `uitests/tests/bootstrap` This is where the source for the bootstrap extension is stored.
-   `uitests/tests/features` Location where all `BDD features` are stored.
-   `uitests/tests/steps` Location where all `BDD steps` are defined.
-   `uitests/tests/js` Location with helper `js` files (download chrome driver and generate html reports).
-   `uitests/tests/vscode` Contains all modules related to `vscode` (driving the UI, downloading, starting, etc).
-   `environment.py` `environment` file for `Behave`.

## CI Integration

* For more details please check `build/ci`.
* We generally try to run all tests against all permutations of OS + Python Version + VSC
    -   I.e. we run tests across permutations of the follows:
        - OS: Windows, Mac, Linux
        - Python: 2.7, 3.5, 3.6, 3.7
        - VSC: Stable, Insiders
* Each scenario is treated as a test
    - These results are published on Azure Devops
    - Artifacts are published containing a folder named `.vscode test/reports/<scenario name>`
        - This folder contains all information related to that test run:
        - Screenshots (including the point in time the test failed) for every step in the scenario (sequentially named files)
        - VS Code logs (including output from the output panels)
        - The workspace folder that was opened in VSC code (we have the exact files used by VSC)
        - Our logs (Extension logs, debugger logs)
        - Basically we have everything we'd need to diagnoze the failure.
* The report for the entire run is uploaded as part of the artifact for the test job.
    - The HTML report contains test results (screenshots & all the steps).
* The same ui tests are run as smoke tests as part of a PR.


## Miscellaneous

*   Use the debug configuration `Behave Smoke Tests` for debugging.
*   In order to pass custom arguments to `Behave`, refer to the `CLI` (pass `behave` specific args after `--` in `python uitests test`).
    - E.g. `python uitests test -- --tags=@wip --more-behave-args`
*   Remember, the automated UI interactions can be faster than normal user interactions.
    - E.g. just because we started debugging (using command `Debug: Start Debugging`), that doesn't mean the debug panel will open immediately. User interactions are slower compared to code execution.
    - Solution, always wait for the UI elements to be available/active. E.g. when you open a file, check whether the corresponding elements are visible.
