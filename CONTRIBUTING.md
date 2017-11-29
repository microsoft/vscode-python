## Contribution

* Please feel free to fork and submit pull requests
* Feature requests can be added [here](https://github.com/Microsoft/vscode-python/issues/new)

## Asking Questions

Have a question? Rather than opening an issue, please ask away on [Stack Overflow](https://stackoverflow.com/questions/tagged/visual-studio-code%20python) using the tags `visual-studio-code` and `python`.

The active community will be eager to assist you. Your well-worded question will serve as a resource to others searching for help.

### Look For an Existing Issue

Before you create a new issue, please do a search in [open issues](https://github.com/Microsoft/vscode-python/issues) to see if the issue or feature request has already been filed.

Be sure to scan through the [most popular](https://github.com/Microsoft/vscode-python/issues?q=is%3Aopen+is%3Aissue+label%3Atype-enhancement+sort%3Areactions-%2B1-desc) feature requests.

If you find your issue already exists, make relevant comments and add your [reaction](https://github.com/blog/2119-add-reactions-to-pull-requests-issues-and-comments). Use a reaction in place of a "+1" comment:

* 👍 - upvote
* 👎 - downvote


If you cannot find an existing issue that describes your bug or feature, create a new issue using the guidelines below.

### Writing Good Bug Reports and Feature Requests

File a single issue per problem and feature request. Do not enumerate multiple bugs or feature requests in the same issue.

Do not add your issue as a comment to an existing issue unless it's for the identical input. Many issues look similar, but have different causes.

The more information you can provide, the more likely someone will be successful reproducing the issue and finding a fix.

Please include the following with each issue:

* Environment information (version info of VS Code, extension, OS and Python)
* Reproducible steps (1... 2... 3...) that cause the issue
* What you expected to see, versus what you actually saw
* Images, animations, or a link to a video showing the issue occuring
* A code snippet that demonstrates the issue or a link to a code repository the developers can easily pull down to recreate the issue locally
  * **Note:** Because the developers need to copy and paste the code snippet, including a code snippet as a media file (i.e. .gif) is not sufficient.
* Errors from the Dev Tools Console (open from the menu: Help > Toggle Developer Tools)

### Final Checklist

Please remember to do the following:
* [ ] Search the issue repository to ensure your report is a new issue
* [ ] Recreate the issue after disabling all extensions
* [ ] Simplify your code around the issue to better isolate the problem

Don't feel bad if the developers can't reproduce the issue right away. They will simply ask for more information!

## Code Contribution

### Prerequisites

1. Node.js (>= 8.9.1, < 9.0.0)
2. Python 2.7 or later (required only for testing the extension and running unit tests)
3. Windows, OS X or Linux

### Setup

```
git clone https://github.com/microsoft/vscode-python
cd vscode-python
npm install
```

### Incremental Build

Run the `Compile` and `Hygiene` build Tasks from the [Command Palette](https://code.visualstudio.com/docs/editor/tasks) (short cut `CTRL+SHIFT+B` or `⇧⌘B`)

### Errors and Warnings

TypeScript errors and warnings will be displayed in VS Code in the Problems Panel (`CTRL+SHIFT+M` or `⇧⌘M`)

### Validate your changes

To test the changes you launch a development version of VS Code on the workspace vscode, which you are currently editing.
Use the `Launch Extension` launch option.

### Unit Tests

Run the Unit Tests via the `Launch Test` and `Launch Multiroot Tests`  launch option.
Currently unit tests only run on [Travis](https://travis-ci.org/Microsoft/vscode-python)

_Requirements_
1. Ensure you have disabled breaking into 'Uncaught Exceptions' when running the Unit Tests
2. For the linters and formatters tests to pass successfully, you will need to have those corresponding Python libraries installed locally

### Standard Debugging

Clone the repo into any directory and start debugging.
From there use the `Launch Extension` launch option.

### Debugging the Python Extension Debugger

The easiest way to debug the Python Debugger (in our opinion) is to clone this git repo directory into [your](https://code.visualstudio.com/docs/extensions/install-extension#_your-extensions-folder) extensions directory.
From there use the ```Extension + Debugger``` launch option.

### Coding Standards

Information on our coding standards can be found [here](https://github.com/Microsoft/vscode-python/blob/master/CODING_STANDARDS.md).
We have a per-commit hook to ensure the code committed will adhere to the above coding standards.
