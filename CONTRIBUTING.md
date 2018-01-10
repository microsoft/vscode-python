# Contributing to the Python extension for Visual Studio Code

## Contributing a pull request

### Prerequisites

1. Node.js (>= 8.9.1, < 9.0.0)
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

### Iteration/milestone cycle

The extension aims for a two-week cycle with an appropriate
[milestone](https://github.com/Microsoft/vscode-python/milestones)
which tracks what is actively being worked on/towards the next
release.

#### Tick-tock development process

Modeled after
[Intel's tick-tock model](https://en.wikipedia.org/wiki/Tick-tock_model),
our development cycle oscillates between two different focuses. In a
"tick" cycle, we discuss potential changes to our development cycle.
This allows to constantly improve how we develop the extension rather
than simply let the process stagnate and develop outmodded approaches.

In a "tock" cycle we apply any changes that were agree to by the team
during the previous "tick" cycle. By taking an entire cycle to discuss
and agree to any changes we provide enough time to reflect upon any
proposed changes so we don't make needless changes.

A "tock" cycle also aims to spend a week purely focused on cleaning up
technical debt. This can be in the form of code refactorings, updating
the code to support new checks introduced by TypeScript, etc. The goal
is to keep the code base manageable long-term and to not end up
calcifying any bad practices. This also provides a good opportunity to
apply any development process changes to work that isn't flagged as
time-critical as a new feature may be.

#### Iteration schedule

* Day 1 (Tuesday)
  * Leave code freeze from previous cycle
  * Incomplete items from the previous cycle are discussed
    * Why didn't an item get completed?
    * Should it transition to this new cycle or be dropped from the
      schedule for now?
    * [tick] Discuss if there's any issues with the current
      development process
    * [tock] Begin applying any changes to the development process as
      agreed upon during the previous "tick" cycle
* Day 7 (Monday)
  * 3rd-party dependencies frozen
  * Ask CELA to update the TPN file
* Day 14 (2nd Monday)
  * Update the TPN file as instructed by CELA
  * Bump version number
  * Code freeze
  * Cut a `.vsix` file for testing
  * Go through
    [issues awaiting validation](https://github.com/Microsoft/vscode-python/issues?q=label%3A%22awaiting+4-validation%22+is%3Aclosed)
    & validate they have been fixed (and not subsequently broken by
    later changes)
  * Update the
    [changelog](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md)
  * Create a branch for the release
  * Unfreeze the `master` branch
  * Make sure the
    [documentation](https://code.visualstudio.com/docs/python/python-tutorial)
    -- including the
    [WOW](https://code.visualstudio.com/docs/languages/python) page
    -- has [appropriate pull requests](https://github.com/microsoft/vscode-docs/pulls)
  * Draft a post for the [team blog](https://aka.ms/pythonblog)

Assuming no last-minute issues, the release should be made public
later that same week. After releasing, the previous release's branch
is turned into a tag and its branch is deleted.

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

* `1-`
  * [`decision`](https://github.com/Microsoft/vscode-python/labels/awaiting%201-decision):
    The issue is a feature enhancement request and a decision has not
    been made as to whether we would accept a pull request
    implementing the enhancement
  * [`more info`](https://github.com/Microsoft/vscode-python/labels/awaiting%201-more%20info):
    We need more information from the OP (original poster)
  * [`verification`](https://github.com/Microsoft/vscode-python/labels/awaiting%201-verification):
    We need to verify that the issue can be replicated
* [`2-PR`](https://github.com/Microsoft/vscode-python/labels/awaiting%202-PR):
  The issue is valid and is now awaiting a pull request to address the
  issue
* [`3-merge`](https://github.com/Microsoft/vscode-python/labels/awaiting%203-merge):
  A pull request has been created and is currently being reviewed
* [`4-validation`](https://github.com/Microsoft/vscode-python/labels/awaiting%204-validation):
  A pull request has been merged and resolution of the issue should be
  independently validated

#### Closed issues

When an
[issue is closed](https://github.com/Microsoft/vscode-python/issues?q=is%3Aissue+is%3Aclosed),
it should have an appropriate `closed-` label.

### Pull request workflow

1. Check that there is an issue corresponding to what the pull request
   is attempting to address
   * If an issue exists, make sure it has reached the stage of being
     labeled `awaiting 2-PR`
   * If no issue exists, open one and wait for it to reach the
     `awaiting 2-PR` stage before submitting the pull request
1. Open the pull request, mentioning the appropriate issue(s)
   * The pull request is expected to have appropriate unit tests
   * The pull request must pass its CI run before merging will be
     considered
1. [Maintainers only] Update referenced issues to the
   `awaiting 3-merge` stage
1. Make sure all status checks are green (e.g. CLA check, CI, etc.)
1. Address any review comments
1. [Maintainers only] Merge the pull request
1. [Maintainers only] Update affected issues to be:
   1. Closed (with an appropriate `closed-` label)
   1. The stage is set to `awaiting 4-validation`
   1. The issue and pull request are attached to the current milestone
   1. Register OSS usage
   1. Email CELA about any 3rd-party usage changes

### Versioning

Starting in 2018, the extension switched to
[calendar versioning](http://calver.org/) since the extension
auto-updates and thus there is no need to track its version
number for backwards-compatibility. As such, the major version
is the current year, the minor version is the current month, and
the micro version is how many releases there have been that month in
the year (starting at 0). For example, the first release in July 2018
would be `2018.7.0`, the second release that month would be
`2018.7.1`, etc.

### Insiders Build

Starting in 2018, we started publishing the latest development
build of the extension onto a cloud storage provider.
If you are interested in helping us test our development builds or would like
to stay ahead of the curve, then please feel free to download and install the
extension from the following [location](https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix). Once you have downloaded the [ms-python-insiders.vsix](https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix)
file, please follow the instructions on [this page](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix) to install the extension.

The insiders build of the extension:
* Will get replcaed with new releases published onto the [VS Code Marketplace](https://marketplace.visualstudio.com/VSCode).
* Does not get updated with new insider build releases.
* Is built everytime a PR is commited into the [master branch](https://github.com/Microsoft/vscode-python).
