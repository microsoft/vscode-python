# Prerequisites

-   Python 3.7 and higher
-   run `python3 -m pip install --user -r news/requirements.txt`

# Release candidate (Monday, XXX XX)

-   [ ] Announce the code freeze on both Teams and e-mail, leave enough time for teams to surface any last minute issues that need to get in before freeze. Make sure debugger and Language Server teams are looped in as well.
-   [ ] Update `main` for the release
    -   [ ] Create a branch against `main` for a pull request
    -   [ ] Change the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) from a `-dev` suffix to `-rc` (🤖)
    -   [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) is up-to-date (🤖)
    -   [ ] Extension will pick up latest version of `debugpy`. If you need to pin to a particular version see `install_debugpy.py`.
    -   [ ] Update `languageServerVersion` in `package.json` to point to the latest version of the [Language Server](https://github.com/Microsoft/python-language-server). Check with the language server team if this needs updating.
    -   [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/main/CHANGELOG.md) (🤖)
        -   [ ] Run [`news`](https://github.com/Microsoft/vscode-python/tree/main/news) (typically `python news --final --update CHANGELOG.md | code-insiders -`)
        -   [ ] Copy over the "Thanks" section from the previous release into the "Thanks" section for the new release
        -   [ ] Make sure the "Thanks" section is up-to-date (e.g. compare to versions in [`requirements.txt`](https://github.com/microsoft/vscode-python/blob/main/requirements.txt))
        -   [ ] Touch up news entries (e.g. add missing periods)
        -   [ ] Check the Markdown rendering to make sure everything looks good
        -   [ ] Add any relevant news entries for `debugpy` and the language server if they were updated
    -   [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/main/ThirdPartyNotices-Distribution.txt) by using https://tools.opensource.microsoft.com/notice (Notes for this process are in the Team OneNote under Python VS Code → Dev Process → Third-Party Notices / TPN file)
    -   [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/main/ThirdPartyNotices-Repository.txt) as appropriate. This file is manually edited so you can check with the teams if anything needs to be added here.
    -   [ ] Create a pull request against `main` (🤖)
    -   [ ] Merge pull request into `main`
-   [ ] Update the [`release` branch](https://github.com/microsoft/vscode-python/branches)
    -   [ ] If there are `release` branches that are two versions old (e.g. release-2020.[current month - 2]) you can delete them at this time
    -   [ ] Create a new `release-YYYY.MM` branch from `main`
-   [ ] Update `main` post-release (🤖)
    -   [ ] Bump the version number to the next monthly ("YYYY.MM.0-dev") release in the `main` branch
        -   [ ] `package.json`
        -   [ ] `package-lock.json`
    -   [ ] Create a pull request against `main`
    -   [ ] Merge pull request into `main`
-   [ ] Announce the code freeze is over on the same channels
-   [ ] Update Component Governance (Notes are in the team OneNote under Python VS Code → Dev Process → Component Governance).
    -   [ ] Make sure there are no active alerts
    -   [ ] Manually add any repository/embedded/CG-incompatible dependencies
-   [ ] GDPR bookkeeping (@brettcannon) (🤖; Notes in OneNote under Python VS Code → Dev Process → GDPR)
-   [ ] Open appropriate [documentation issues](https://github.com/microsoft/vscode-docs/issues?q=is%3Aissue+is%3Aopen+label%3Apython)
    -   new features
    -   settings changes
    -   etc. (ask the team)
-   [ ] Schedule a bug bash. Aim for close after freeze so there is still time to fix release bugs before release. Ask teams before bash for specific areas that need testing.
-   [ ] Begin drafting a [blog](http://aka.ms/pythonblog) post. Contact the PM team for this.
-   [ ] Ask CTI to test the release candidate

# Final (Monday, XXX XX)

## Preparation

-   [ ] Make sure the [appropriate pull requests](https://github.com/microsoft/vscode-docs/pulls) for the [documentation](https://code.visualstudio.com/docs/python/python-tutorial) -- including the [WOW](https://code.visualstudio.com/docs/languages/python) page -- are ready
-   [ ] Final updates to the `release-YYYY.MM` branch
    -   [ ] Create a branch against `release-YYYY.MM` for a pull request
    -   [ ] Update the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) to remove the `-rc` (🤖)
    -   [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) is up-to-date (the only update should be the version number if `package-lock.json` has been kept up-to-date) (🤖)
    -   [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/main/CHANGELOG.md) (🤖)
        -   [ ] Update version and date for the release section
        -   [ ] Run [`news`](https://github.com/Microsoft/vscode-python/tree/main/news) and copy-and-paste new entries (typically `python news --final | code-insiders -`; quite possibly nothing new to add)
    -   [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/main/ThirdPartyNotices-Distribution.txt) by using https://tools.opensource.microsoft.com/notice (🤖; see team notes)
    -   [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/main/ThirdPartyNotices-Repository.txt) manually if necessary
    -   [ ] Create pull request against `release-YYYY.MM` (🤖)
    -   [ ] Merge pull request into `release-YYYY.MM`
-   [ ] Make sure component governance is happy

## Release

-   [ ] Publish the release (🤖)
    -   [ ] Make sure [CI](https://github.com/microsoft/vscode-python/actions?query=workflow%3A%22Insiders+Build%22) is passing
    -   [ ] Download the artifact containing the VSIX and make sure no extraneous files are being included in the `.vsix` file (make sure to check for hidden files)
    -   [ ] [Update the Marketplace](https://marketplace.visualstudio.com/manage/publishers/ms-python)
    -   [ ] From a VS Code instance uninstall the python extension. After the publish see if the new version is available from the extensions tab. Download it and quick sanity check to make sure the extension loads.
-   [ ] Create a [GitHub release](https://github.com/microsoft/vscode-python/releases) (🤖)
    -   [ ] Start creating a new release
    -   [ ] Make the tag match the version of the released extension
    -   [ ] Copy the changelog entry into the release as the description
-   [ ] Publish [documentation changes](https://github.com/Microsoft/vscode-docs/pulls?q=is%3Apr+is%3Aopen+label%3Apython)
-   [ ] Publish the [blog](http://aka.ms/pythonblog) post
-   [ ] Determine if a hotfix is needed
-   [ ] Merge `release-YYYY.MM` back into `main`. Don't overwrite the `-dev` version in package.json. (🤖)

## Clean up after _this_ release

-   [ ] Go through [`info needed` issues](https://github.com/Microsoft/vscode-python/issues?q=is%3Aopen+label%3A%22info+needed%22+sort%3Aupdated-asc) and close any that have no activity for over a month (🤖)
-   [ ] GDPR bookkeeping (🤖)

## Prep for the _next_ release

-   [ ] Create a new [release plan](https://raw.githubusercontent.com/microsoft/vscode-python/main/.github/release_plan.md) (🤖)
-   [ ] [(Un-)pin](https://help.github.com/en/articles/pinning-an-issue-to-your-repository) [release plan issues](https://github.com/Microsoft/vscode-python/labels/release%20plan) (🤖)
