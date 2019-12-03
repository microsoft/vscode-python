# VS Code Smoke Test

## Usage

```shell
$ # The step `npm run package` is required to ensure the 'ms-python-insiders.vsix' is available locally.
$ # You could instead just download this and dump into the working directory (much faster).
$ # npm run package # see notes above.


$ npm run compile
$ node ./out/index download # Download VS Code (check cli args for options to download VS Code insiders)
$ node ./out/index install  # Install the extensions into VS Code (ensure the file `ms-python-insiders.vsix` exists in the root directory)
$ node ./out/index test     # Launches the tests
$ node ./out/index --help   # for more information
$ node ./out/index <command> --help   # for more information

```

## Overview

* These are a set of UI tests for the Python Extension in VSC.
* The UI is driven using the same infrastructure as used by `VS Code` for their smoke tests.
* [BDD](https://en.wikipedia.org/wiki/Behavior-driven_development) is used to create the tests, and executed using [cucumberjs](https://github.com/cucumber/cucumber-js).

## How to run smoke tests?

Here are the steps involved in running the tests:

* Setup environment:
    * Pull down `ms-python-extension.vsix` from Azure Pipline.
    * Download a completely fresh version of VS Code (`stable/insiders`. Defaults to `stable`).
        (configurable using the `--channel=stable | --channel=insider`)
    * Create a folder named `.vscode test` where test specific files will be created (reports, logs, VS Code, etc).

## How does it work?
* When launching VSC, we will launch it as a completely stand alone version of VSC.
    * I.E. even if it is installed on the current machine, we'll download and launch a new instance.
    * This new instance will not interfere with currently installed version of VSC.
    * All user settings, etc will be in a separate directory (see `user` folder).
    * VSC will not have any extensions. We are in control of what extensions are installed (see `.vscode test/extensions` folder).
* Automate VSC UI
    * Use Puppeteer to automate the UI.
    * The [BDD](https://en.wikipedia.org/wiki/Behavior-driven_development) tests are written and executed using [cucumberjs](https://github.com/cucumber/cucumber-js).
* Workspace folder/files
    * Each [feature](https://docs.cucumber.io/gherkin/reference/#feature) can have its own set of files in the form of a github repo.
    * Just add a tag with the path of the github repo url to the `feature`.
    * When starting the tests for a feature, the repo is downloaded into a new random directory `.vscode test/temp/workspace folder xyz`
    * At the begining of every scenario, we repeat the previous step.
    * This ensures each scenario starts with a clean workspace folder.
*   Reports
    * Test results are stored in the `.vscode test/reports` directory
    * These `json` (`cucumber format`) report files are converted into HTML using an `npm` script [cucumber-html-reporter](https://www.npmjs.com/package/cucumber-html-reporter).
    * For each `scenario` that's executed, we create a corresponding directory in `.vscode test/reports` directory.
        * This will contain all screenshots realted to that scenario.
        * If the scenario fails, all logs, workspace folder are copied into this directory.
        * Thus, when ever a test fails, we have everything related to that test.
        * If the scenario passes, this directory is deleted (we don't need them on CI server).

## Technology

* 100% of the code is written in `nodejs`.
* The tests are written using [cucumberjs](https://github.com/cucumber/cucumber-js).
* Puppeteer is used to drive the VS Code UI.
* `GitHub` repos are used to provide the files to be used for testing in a workspace folder.
    * This needs to be replaced with local source (has been done for some, not others).
* reports (`cucumber format`) are converted into HTML using an `npm` script [cucumber-html-reporter](https://www.npmjs.com/package/cucumber-html-reporter).
* Test result reports are generated using `junit` format, for Azure Devops.


## Files & Folders

* `~/vscode test` Directory used for storing everything related to a test run (VS Code, reports, logs, etc).
    * `./stable` This is VS Code stable is downloaded.
    * `./insider` This is VS Code insider is downloaded.
    * `./user` Directory VS Code uses to store user information (settings, etc)
    * `./extensions` This is where the extensions get installed for the instance of VSC used for testing.
    * `./workspace folder` Folder opened in VS Code for testing
    * `./temp path` Temporary directory for testing. (sometimes tests will create folders named `workspace folder xyz` to be used as workspace folders used for testing)
    * `./reports` Location where generated reports are stored.
    * `./logs` Logs for tests
    * `./screenshots` Screen shots captured during tests
* `~/src/uitest/bootstrap` Contains just the bootstrap extension code.
* `~/src/uitests/features` [Feature files](https://cucumber.io/docs/gherkin/reference/#feature) used to drive the [BDD](https://en.wikipedia.org/wiki/Behavior-driven_development) tests are stored here.
* `~/src/uitests/src` Source code for smoke Tests (features, nodejs code, etc).
* `~/code/` Folder containing workspaces (python files) used for testing purposes.

## CI Integration

* For more details please check `build/ci`.
* We generally try to run all tests against all permutations of OS + Python Version + VSC
    * I.e. we run tests across permutations of the follows:
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


## Caveats
* The tests rely on the structure of the HTML elements (& their corresponding CSS/style attribute values).
    - Basically we have hardcoded the CSS queries. If VS Code were to change these, then the tests would fail.
    - One solution is to pin the UI tests against a stable version of VS Code.
    - When ever a new version of VS Code is released, then move CSS queries from `insider` into `stable` found in the `src/uitests/src/selectors.ts` file.
    - This way tests/CI will not fail and we'll have time to address the CSS/HTML changes.

## Miscellaneous

* For debugging follow these steps:
    * Use the debug configuration `UI Tests`.
* Remember, the automated UI interactions can be faster than normal user interactions.
    * E.g. just because we started debugging (using command `Debug: Start Debugging`), that doesn't mean the debug panel will open immediately. User interactions are slower compared to code execution.
    * Solution, always wait for the UI elements to be available/active. E.g. when you open a file, check whether the corresponding elements are visible.
* Details of tags can be found here [features/README.md](./features/README.md)


## Code Overview
* Tests are written in nodejs. Why?
    * Short answer - We're using Puppeteer (managed by the Chrome team).
    * Previously we wrote tests using `selenium`. However a week after the tests were running, VSC released a new version. This new version of VSC had a version of Electron + Chromium that didn't have a compatible version of `chrome driver`.
    * The chrome `chrome driver` is used by `selenium` to drive the tests. Also using `selenium` we had tonnes of issues.
    * Solution - Use the same technique used by VS Code to drive their UI Tests.
* Bootstrap extension ([src/smoke/bootstrap](https://github.com/microsoft/vscode-python/tree/master/src/smoke/bootstrap))
    * Short answer - Used to update the `settings.json` and detect loading of `Python Extension`.
    * When updating settings in VSC, do not alter the settings files directly. VSC could take a while to detect file changes and load the settings.
        - An even better way, is to use the VSC api to update the settings (via the bootstrap API) or edit the settings file directly through the UI.
        - Updating settings through the editor (by editing the `settings.json` file directly is not easy, as its not easy to update/remove settings).
        - Using the API we can easily determine when VSC is aware of the changes (basically when API completes, VSC is aware of the new settings).
        - (This is made possible by writing the settings to be updated into `settingsToUpdate.txt`, and letting the bootstrap extension read that file and update the VSC settings using the VSC API).
    * Similarly checking whether the `Python Extension` has activated is done by the `bootstrap` extension by creating a new status bar item
        * The prescence of this new status bar indicates the fact that the extension has activated successfully.
    * The code for this extension resides in [src/smoke/bootstrap](https://github.com/microsoft/vscode-python/tree/master/src/smoke/bootstrap)
