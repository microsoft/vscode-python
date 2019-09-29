# Tags
* @wip
    * Used only for debugging purposes.
    * When debugging in VSC, only features/scenarios with @wip tag will be executed.
* @skip
    * Used to skip a feature/scenario.
* @https://github.com/xxx/yyy.git
    * Can only be used at a feature level.
    * The conents of the above repo will be used as the contents of the workspace folder.
    * Note: assume the tag is `@https://github.com/DonJayamanne/pyvscSmokeTesting.git`
        * The above repo is cloned directly into the workspace.
    * If however the tag is `@https://github.com/DonJayamanne/pyvscSmokeTesting/tests`
        * Now, the contents of the workspace is the `tests` directory in the above repo.
    * This allows us to have a single repo with files/tests for more than just one feature/scenario.
    * Else we'd need to have multiple repos for each feature/scenario.
* @code:<path relative to uitests folder>
    * Can only be used at a feature level.
    * The conents of the above folder will be used as the contents of the workspace folder.
    * Note: assume the tag is `@code:some folder/pythonFiles`
        * The contents of the above folder is copied recursively into the workspace.
    * This allows us to have a single repo with files/tests for more than just one feature/scenario.
    * Else we'd need to have multiple repos for each feature/scenario.
* @mac, @win, @linux
    * Used to ensure a particular feature/scenario runs only in mac, win or linux respectively.
* @python2, @python3, @python3.5, @python3.6, @python3.7
    * Used to ensure a particular feature/scenario runs only in specific version of Python, respectively.
* @noNeedToTestInAllPython
    * Indicates these are tests that are not specific to a version of Python used.
    * Hence testing in any one version of Python is sufficient.
* @insider
    * Used to ensure a particular feature/scenario runs only in VS Code Insiders.
* @stable
    * Used to ensure a particular feature/scenario runs only in VS Code Stable.
* @smoke
    * All smoke test related functionality.
* @test
    * All testing related functionality.
* @debug
    * All debugger related functionality.
* @terminal
    * All terminal related functionality.
* @terminal.venv
    * Related to virtual environments (`python -m venv`)
* @terminal.pipenv
    * Related to pipenv environments (`pipenv shell`)
