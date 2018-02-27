# Contributing to the Python extension for Visual Studio Code

## Contributing a pull request

### Prerequisites

1. Node.js (>= 8.9.1, < 9.0.0), and [Yarn](https://yarnpkg.com/lang/en/docs/install/)
2. Python 2.7 or later (required only for testing the extension and running unit tests)
3. Windows, OS X or Linux
4. Visual Studio Code
5. Following VS Code extensions:
    * [TSLint](https://marketplace.visualstudio.com/items?itemName=eg2.tslint)
    * [EditorConfig for VS Code](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)

### Setup

```shell
git clone https://github.com/microsoft/vscode-python
cd vscode-python
yarn install
```

You may see warnings that ```The engine "vscode" appears to be invalid.```, you can ignore these.

### Incremental Build

Run the `Compile` and `Hygiene` build Tasks from the [Command Palette](https://code.visualstudio.com/docs/editor/tasks) (short cut `CTRL+SHIFT+B` or `⇧⌘B`)

### Errors and Warnings

TypeScript errors and warnings will be displayed in VS Code in the following areas:
* Problems Panel (`CTRL+SHIFT+M` or `⇧⌘M`)
* Terminal running the `Compile` task
* Terminal running the `Hygiene` task

### Validate your changes

To test the changes you launch a development version of VS Code on the workspace vscode, which you are currently editing.
Use the `Launch Extension` launch option.

### Unit Tests

Run the Unit Tests via the `Launch Test` and `Launch Multiroot Tests`  launch option.
Currently unit tests only run on [Travis](https://travis-ci.org/Microsoft/vscode-python)

#### Requirements

1. Ensure you have disabled breaking into 'Uncaught Exceptions' when running the Unit Tests
1. For the linters and formatters tests to pass successfully, you will need to have those corresponding Python libraries installed locally

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
(which is actively updated as plans change).

The overall schedule for a release is to feature freeze for on the last
Monday of the month to coincide with Visual Studio Code's code freeze.
We then aim to release later that week so the latest version of the
extension is already live by the time Visual Studio Code launches
their new release. This is so we are ready to use any new features
of Visual Studio Code the day they go live. We do bugfix-only releases
between scheduled releases as necessary.

All development is actively done in the `master` branch of the
repository. It is what allows us to have an
[insiders build](#insiders-build) which is expected to be stable at
all times. We do keep the most recent release as a branch in case the
need for a bugfix release arises. But once a new release is made we
delete the older release branch (all releases are appropriately
tagged, so history is lost).

### Issue triaging

To help actively track what stage issues are at, various labels are
used. Which labels are expected to be set vary from when an issue is
open to when an issue is closed.

#### Open issues

When an
[issue is first opened](https://github.com/Microsoft/vscode-python/issues),
it is triaged to contain at least three types of labels:

1. `awaiting`
1. `feature`
1. `type`

These labels cover what is blocking the issue from closing, what
feature(s) of the extension are related to the issue, and what type of
issue it is, respectively.

While most of the labels are self-explanatory, the `awaiting` labels
deserve some more explanation. Each label has a number that roughly
corresponds to what step in the process it is at (so that the labels
lexicographically sort from earliest stage to latest stage). The
suffix term for each label then specifies what is currently blocking
the issue from being closed.

* [`1-decision`](https://github.com/Microsoft/vscode-python/labels/awaiting%201-decision):
The issue is a feature enhancement request and a decision has not
been made as to whether we would accept a pull request
implementing the enhancement
* [`1-more info`](https://github.com/Microsoft/vscode-python/labels/awaiting%201-more%20info):
We need more information from the OP (original poster)
* [`1-verification`](https://github.com/Microsoft/vscode-python/labels/awaiting%201-verification):
    We need to verify that the issue is reproducible
* [`2-PR`](https://github.com/Microsoft/vscode-python/labels/awaiting%202-PR):
  The issue is valid and is now awaiting a fix to be created and
  merged into the `master` branch

#### Closed issues

When an
[issue is closed](https://github.com/Microsoft/vscode-python/issues?q=is%3Aissue+is%3Aclosed),
it should have an appropriate `closed-` label.

### Pull request workflow

1. Check that there is an issue corresponding to what the pull request
   is attempting to address
   * If an issue exists, make sure it has reached the stage of
     `awaiting 2-PR`
   * If no issue exists, open one and wait for it to reach the
     `awaiting 2-PR` stage before submitting the pull request
1. Create the pull request, mentioning the appropriate issue(s) in the
   pull request message body
   * The pull request is expected to have appropriate unit tests
   * The pull request must pass its CI run before merging will be
     considered
   * Code coverage is expected to (at minimum) not worsen
1. Make sure all status checks are green (e.g. CLA check, CI, etc.)
1. Address any review comments
1. [Maintainers only] Merge the pull request
1. [Maintainers only] Update affected issues to be:
   1. Closed (with an appropriate `closed-` label)
   1. The issue(s) are attached to the current milestone
   1. Register OSS usage
   1. Email CELA about any 3rd-party usage changes

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

## Insiders Build

Starting in 2018, we started publishing the latest development
build of the extension onto a cloud storage provider.
If you are interested in helping us test our development builds or would like
to stay ahead of the curve, then please feel free to download and install the
extension from the following
[location](https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix)
(if the CI build is passing: [![Build Status](https://travis-ci.org/Microsoft/vscode-python.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-python)).
Once you have downloaded the
[ms-python-insiders.vsix](https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix)
file, please follow the instructions on
[this page](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix)
to install the extension.

The insiders build of the extension:

* Will be replaced with new releases published onto the
  [VS Code Marketplace](https://marketplace.visualstudio.com/VSCode).
* Does not get updated with new insider build releases (if you want to
  test a newer insiders build, uninstall the old version of the
  extension and then install the new version)
* Is built everytime a PR is commited into the [`master` branch](https://github.com/Microsoft/vscode-python).
