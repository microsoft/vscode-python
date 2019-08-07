-   [ ] Dynamic detection of where `pyenv` environments are created and stored
    -   uitests/uitests/vscode/startup.py
-   [ ] CRC compare files unzipped using python module and general unzipping.
    -   [ ] Identify whats wrong and file an issue upstream on Python if required.
    -   [ ] Use node.js as alternative
-   [ ] Unzip using Python code
    -   Unzip tar files.
-   [ ] Conda on Azure Pipelines don't work as the `environments.txt` file is not available/not updated.
    -   Is this the case in realworld?
    -   We need a fix/work around.
-   [ ] Ensure we use spaces in path to the extension
    -   We have had bugs where extension fails due to spaces in paths (user name)
    -   Debugger fails
-   [ ] When testing VS Code insiders, use the same chrome driver used in stable.
    -   Just hardcode the version of the chrome driver for now.
-   [ ] Fail CI if a file is not created or vice versa.
        Or run another script that'll check the existence and fail on stderr.
        We don't want behave to monitor stderr, as we can ignore many errors.
