# Contributing to the Python extension for Visual Studio Code




---

| macOS/Windows CI | Linux CI | Rolling CI (macOS/Windows) | Code Coverage |
|-|-|-|-|
|[![Build status](https://vscode-python.visualstudio.com/VSCode-Python/_apis/build/status/VSCode-Python-CI)](https://vscode-python.visualstudio.com/VSCode-Python/_build/latest?definitionId=4) | [![Build Status (Travis)](https://travis-ci.org/Microsoft/vscode-python.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-python/branches) | [![Build status](https://vscode-python.visualstudio.com/VSCode-Python/_apis/build/status/VSCode-Python-Rolling-CI)](https://vscode-python.visualstudio.com/VSCode-Python/_build/latest?definitionId=9) | [![codecov](https://codecov.io/gh/Microsoft/vscode-python/branch/master/graph/badge.svg)](https://codecov.io/gh/Microsoft/vscode-python)|

[[Development build](https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix)]

---

[[Contributing to Python Analysis Engine](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING%20-%20PYTHON_ANALYSIS.md) is covered in a separate document.]

## Contributing a pull request

### Prerequisites

1. Node.js (>= 8.9.1, < 9.0.0)
2. Python 2.7 or later (required only for testing the extension and running unit tests)
3. Windows, macOS, or Linux
4. Visual Studio Code
5. Following VS Code extensions:
    * [TSLint](https://marketplace.visualstudio.com/items?itemName=eg2.tslint)
    * [EditorConfig for VS Code](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)

### Setup

```shell
git clone --recurse-submodules https://github.com/microsoft/vscode-python
cd vscode-python
npm install
```

You may see warnings that ```The engine "vscode" appears to be invalid.```, you can ignore these.

### Incremental Build

Run the `Compile` and `Hygiene` build Tasks from the [Command Palette](https://code.visualstudio.com/docs/editor/tasks) (short cut `CTRL+SHIFT+B` or `⇧⌘B`)

### Errors and Warnings

TypeScript errors and warnings will be displayed in the `Problems` window of Visual Studio Code:

### Validate your changes

To test the changes you launch a development version of VS Code on the workspace vscode, which you are currently editing.
Use the `Launch Extension` launch option.

### Unit Tests

1. Ensure you have disabled breaking into 'Uncaught Exceptions' when running the Unit Tests
1. For the linters and formatters tests to pass successfully, you will need to have those corresponding Python libraries installed locally
1. Run the Unit Tests via the `Launch Test` and `Launch Multiroot Tests`  launch options.

### Standard Debugging

Clone the repo into any directory and start debugging.
From there use the `Launch Extension` launch option.

### Debugging the Python Extension Debugger

The easiest way to debug the Python Debugger (in our opinion) is to clone this git repo directory into [your](https://code.visualstudio.com/docs/extensions/install-extension#_your-extensions-folder) extensions directory.
From there use the ```Extension + Debugger``` launch option.

### Coding Standards

Information on our coding standards can be found [here](https://github.com/Microsoft/vscode-python/blob/master/CODING_STANDARDS.md).
We have a pre-commit hook to ensure the code committed will adhere to the above coding standards.

## Development process

To effectively contribute to this extension, it helps to know how its
development process works. That way you know not only why the
project maintainers do what they do to keep this project running
smoothly, but it allows you to help out by noticing when a step is
missed or to learn in case someday you become a project maintainer as
well!

### Helping others

First and foremost, we try to be helpful to users of the extension.
We monitor
[Stack Overflow questions](https://stackoverflow.com/questions/tagged/visual-studio-code+python)
to see where people might need help. We also try to respond to all
issues in some way in a timely manner (typically in less than one
business day, definitely no more than a week). We also answer
questions that reach us in other ways, e.g. Twitter.

### Iteration/milestone cycle

The extension aims to do a new release every month. A
[release plan](https://github.com/Microsoft/vscode-python/labels/release%20plan)
is created for each release to help track anything that requires a
person to do (long term this project aims to automate as much of the
development process as possible). The current issues being worked on
for a release are tracked in a
[milestone](https://github.com/Microsoft/vscode-python/milestones)
(which is actively updated as plans change). All
[P0](https://github.com/Microsoft/vscode-python/labels/P0) are expected to
be fixed in a milestone, else the release will be blocked.
[P1](https://github.com/Microsoft/vscode-python/labels/P1) issues are a
top-priority in a milestone, but if they are not completed they will not
block a milestone. All other issues are considered best-effort for that
milestone.

The overall schedule for a release is to feature freeze for on the last
Monday of the month to coincide with Visual Studio Code's code freeze.
We then aim to release later that week so the latest version of the
extension is already live by the time Visual Studio Code does their
release the following week. This is so we are ready to use any new features
of Visual Studio Code the day they go live. We do bugfix-only releases
between scheduled releases as necessary, but otherwise we aim to do one
release a month.

All development is actively done in the `master` branch of the
repository. It is what allows us to have a
[development build](#development-build) which is expected to be stable at
all times. We do keep the most recent release as a branch in case the
need for a bugfix release arises. But once a new release is made we
delete the older release branch (all releases are appropriately
tagged, so no history is lost).

### Issue triaging

To help actively track what stage
[issues](https://github.com/Microsoft/vscode-python/issues)
are at, various labels are used. The following label types are expected to
be set on all open issues (otherwise the issue is not considered triaged):

1. `needs`
1. `feature`
1. `type`

These labels cover what is blocking the issue from closing, what is affected by
the issue, and what kind of issue it is.

It is also important to make the title accurate. People often write very brief, quick titles or ones that describe what they think the problem is. By updating the title to be appropriately descriptive for what _you_ think the issue is, you not only make finding older issues easier, but you also help make sure that you and the original reporter agree on what the issue is.

#### Closed issues

When an issue is closed  by a pull request we add a
[`validate fix`](https://github.com/Microsoft/vscode-python/issues?q=label%3A%22validate+fix%22+is%3Aclosed)
label in order to request people help us test the fix to validate the issue was
resolved successfully. Once the fix has been manually validated we remove the label.

### Pull request workflow

Key details that all pull requests are expected to handle should be
in the PR template. The only key detail not covered in that template is
that any change in our dependencies must be properly reflected in our
third-party notices file and registered with the OSPO internally at
Microsoft (obviously external developers do not need to concern themselves
with these legal/technical issues).

### Versioning

Starting in 2018, the extension switched to
[calendar versioning](http://calver.org/) since the extension
auto-updates and thus there is no need to track its version
number for backwards-compatibility. As such, the major version
is the current year, the minor version is the month when feature
freeze was reached, and the micro version is how many releases there
have been since that feature freeze (starting at 0). For example
the release made when we reach feature freeze in July 2018
would be `2018.7.0`, and if a second release was necessary to fix a
critical bug it would be `2018.7.1`.

## Development Build

We publish the latest development
build of the extension onto a cloud storage provider.
If you are interested in helping us test our development builds or would like
to stay ahead of the curve, then please feel free to download and install the
extension from the following
[location](https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix).
Once you have downloaded the
[ms-python-insiders.vsix](https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix)
file, please follow the instructions on
[this page](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix)
to install the extension.

The development build of the extension:

* Will be replaced with new releases published onto the
  [VS Code Marketplace](https://marketplace.visualstudio.com/VSCode).
* Does not get updated with new development builds of the extension (if you want to
  test a newer development build, uninstall the old version of the
  extension and then install the new version)
* Is built everytime a PR is commited into the [`master` branch](https://github.com/Microsoft/vscode-python).
