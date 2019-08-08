-   [ ] Dynamic detection of where `pyenv` environments are created and stored
-   [ ] Conda on Azure Pipelines don't work as the `environments.txt` file is not available/not updated.
    -   Is this the case in realworld?
    -   We need a fix/work around.
-   [ ] Ensure we use spaces in path to the extension
    -   We have had bugs where extension fails due to spaces in paths (user name)
    -   Debugger fails
-   [ ] Fail CI if a file is not created or vice versa.
        Or run another script that'll check the existence and fail on stderr.
        We don't want behave to monitor stderr, as we can ignore many errors.
