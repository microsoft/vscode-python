# xxx Tests for Python Extension.
## Usage

Assuming you have created a virtual environment (for Python 3.7),
installed the `requirements.txt` dependencies, and activated the virtual environment:

```shell
$ python uitests download
$ python uitests install
$ python uitests test
```

## Overview
* These are a set of UI tests for the Python Extension in VSC.
* The UI is driven using the [selenium webdriver](https://selenium-python.readthedocs.io/).
* [BDD](https://docs.cucumber.io/bdd/overview/) is used to create the tests using [Behave](https://behave.readthedocs.io/en/latest/).


## How does it work?
Here are the steps involved in running the tests:
* Setup environment:
    * Download a completely fresh version of VS Code.
    * Identify the version of [Electron](https://electronjs.org/) that VS Code is built upon.
    * Download [Chrome Driver](http://chromedriver.chromium.org/) corresponding to the version of Electron used.
        * When running tests, the `chrome driver` needs to be in the current path.
    * Use [selenium webdriver](https://selenium-python.readthedocs.io/) to drive the VSC UI.
    * Create a folder named `.vsccode-test` with the following sub-directories:
* When launching VSC, we will launch it as a completely stand alone version of VSC.
    * I.e. even if it is installed on the current machine, we'll download and launch a new instance.
    * This new instance will not interfere with currently installed version of VSC.
    * All user settings, etc will be in a separate directory (see `user` folder).
    * VSC will not have any extensions (see `extensions` folder).
* Automate VSC UI
    * Launch VSC using the [Chrome Driver](http://chromedriver.chromium.org/)
    * Use [selenium webdriver](https://selenium-python.readthedocs.io/) to drive the VSC UI.
    * The tests are written and executed using [Behave](https://behave.readthedocs.io/en/latest/).
* Workspace folder/files
    * Each [feature](https://docs.cucumber.io/gherkin/reference/#feature) can have its own set of files in the form of a github repo.
    * Just add a tag with the path of the github repo url to the `feature`.
    * When starting the tests for a feature, the repo is downloaded into `workspace folder`.
    * At the begining of every scenario, the workspace folder is reset.
    * This ensures each scenario starts with a clean workspace folder.
* Reports
    * Test results are stored in the `reports` directory
    * These `json` (`cucumber format`) report files are converted into HTML using an `npm` script [cucumber-html-reporter](https://www.npmjs.com/package/cucumber-html-reporter).


## Technology
* 99% of the code is written in `Python`.
* Downloading of `chrome driver` and generating `html reports` is done in `node.js` (using pre-existing `npm` packages).
* The tests are written using [Behave](https://behave.readthedocs.io/en/latest/) in `Python`.
* `GitHub` repos are used to provide the files to be used for testing in a workspace folder.
* The reports (`cucumber format`) are converted into HTML using an `npm` script [cucumber-html-reporter](https://www.npmjs.com/package/cucumber-html-reporter).


## Caveats
* **If using the `node.js` scripts from VSC itself, most of the following caveats do not apply. However as we're using Python, hence there are a few drawbacks.**
* VSC UI must be a top level window for elements to receive focus. Hence when running tests, do not do anything else.
* Screenshots are generally embedded into the HTML report, however as the number of tests grow so would the size of the generated `json` and resultant `html` file.
    * If the size is too large then consider storing the `screenshots` as external files (see `--embed-screenshots` CLI arg).
* Reloading VSC will reset the connection (`driver` connection).
    * Hence reloading is basically performed by re-starting VSC.
* As reloading of VSC is not a cheap operation, resettting workspaces is slow.
    * Current approach is to `clone` a `git repo` directly into the workspace folder and use `git reset` for ever scenario.
    * Note: Deleting workspace folder is not an option, as this would result in VSC loosing the workspace folder (things go south from there).
* `chrome driver` only supports arguments that begin with `--`. Hence arguments passed to VSC are limited to those that start with `--`.
* `Terminal` output cannot be retrieved using the `driver`. Hence output from terminal cannot be inspected.
* Sending characters to an input is slow, the `selenium driver` seems to send text one character at a time. Hence tests are slow.
* `Behave` does not generate reports that comply with the `cucumber json` report format. Hence the custom formatter in `report.py`.
    * Using a `cucumber json` report format allows us to use existing tools to generate other HTML reports out of the raw `json` files.
* Sending keyboard commands to VSC is currently not possible (not known).
    * `Selenium driver` can only send keyboard commands to a specific `html element`.
    * But kyeboard commands such as `ctrl+p` are to be sent to the main window, and this isn't possible/not known.
    * Fortunately almost everything in VSC can be driven through commands in the `command palette`.
        * Hence, we have an extension that opens the `command palette`, from there, we use `selenium driver` to select commands.
        * This same extension is used to `activate` the `Python extension`.
        * This extension is referred to as the `bootstrap extension`.


## Files & Folders

* The folder `.vsccode-test` in the root directory is where VSC is downloaded, workspace files created, etc.
    * `extensions`      This is where the extensions get installed for the instance of VSC used for testing.
    * `reports`         Location where generated reports are stored.
    * `screenshots`     Location where screenshots are stored.
    * `stable`          Loaction where stable version of VSC is downloaded and stored.
    * `insiders`        Loaction where insiders version of VSC is downloaded and stored.
    * `user`            Loaction where user information related to VSC is stored.
    * `workspace folder`Workspace folder opened in VSC (this is where files used for smoke tests will be stored).
* `uitests/tests/bootstrap`  This is where the source for the bootstrap extension is stored.
* `uitests/tests/features`   Location where all `BDD features` are stored.
* `uitests/tests/steps`      Location where all `BDD steps` are defined.
* `uitests/tests/js`         Location with helper `js` files (download chrome driver and generate html reports).
* `uitests/tests/vscode`     Contains all modules related to `vscode` (driving the UI, downloading, starting, etc).
* `environment.py`              `enviroyment` file for `Behave`.


## Miscellaneous
* Use the debug configuration `Behave Smoke Tests` for debugging.
* In order to pass custom arguments to `Behave`, refer to the `CLI` (pass `behave` specific args after `--` in `python uitests test`).
