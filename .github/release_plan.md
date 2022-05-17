All dates should align with VS Code's [iteration](https://github.com/microsoft/vscode/labels/iteration-plan) and [endgame](https://github.com/microsoft/vscode/labels/endgame-plan) plans.

# Feature freeze (Monday @ 17:00 America/Vancouver, XXX XX)

-   [ ] Announce the feature freeze on both Teams and e-mail, leave enough time for teams to surface any last minute issues that need to get in before freeze. Make sure debugger and Language Server teams are looped in as well.

# Release candidate (Monday, XXX XX)

-   [ ] Update `main` for the release
    -   [ ] Change the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) to the next **even** number (🤖)
    -   [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) is up-to-date (🤖)
    -   [ ] Check `pypi.org` and update the version of `debugpy` in `install_debugpy.py` if necessary.
    -   [ ] Update `languageServerVersion` in `package.json` to point to the latest version of the [Language Server](https://github.com/Microsoft/python-language-server). Check with the language server team if this needs updating (🤖)
    -   [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/main/CHANGELOG.md) (🤖)
        -   [ ] Run [`news`](https://github.com/Microsoft/vscode-python/tree/main/news) (typically `python news --final --update CHANGELOG.md | code-insiders -`)
        -   [ ] Copy over the "Thanks" section from the previous release into the "Thanks" section for the new release
        -   [ ] Make sure the "Thanks" section is up-to-date (e.g. compare to versions in [`requirements.txt`](https://github.com/microsoft/vscode-python/blob/main/requirements.txt))
        -   [ ] Touch up news entries (e.g. add missing periods)
        -   [ ] Check the Markdown rendering to make sure everything looks good
        -   [ ] Add any relevant news entries for `debugpy` and the language server if they were updated
    -   [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/main/ThirdPartyNotices-Distribution.txt) by using https://tools.opensource.microsoft.com/notice (Notes for this process are in the Team OneNote under Python VS Code → Dev Process → Third-Party Notices / TPN file)
    -   [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/main/ThirdPartyNotices-Repository.txt) as appropriate. This file is manually edited so you can check with the teams if anything needs to be added here.
    -   [ ] Merge pull request into `main`
-   [ ] Create the [`release` branch](https://github.com/microsoft/vscode-python/branches)
    -   [ ] If there are `release` branches that are two versions old (e.g. release-2020.[minor - 2]) you can delete them at this time
    -   [ ] Create a new `release/YYYY.minor` branch from `main`
-   [ ] Update `main` post-release (🤖)
    -   [ ] Bump the minor version number to the next ("YYYY.[minor+1]") release in the `main` branch to an **odd** number (🤖)
        -   [ ] `package.json`
        -   [ ] `package-lock.json`
    -   [ ] Create a pull request against `main`
    -   [ ] Merge pull request into `main`
-   [ ] Announce the code freeze is over on the same channels
-   [ ] Update Component Governance (Notes are in the team OneNote under Python VS Code → Dev Process → Component Governance).
    -   [ ] Make sure there are no active alerts
    -   [ ] Manually add any repository/embedded/CG-incompatible dependencies
-   [ ] Open appropriate [documentation issues](https://github.com/microsoft/vscode-docs/issues?q=is%3Aissue+is%3Aopen+label%3Apython)
-   [ ] Begin drafting a [blog](http://aka.ms/pythonblog) post. Contact the PM team for this.

# Release (Wednesday, XXX XX)

## Preparation

-   [ ] Make sure the [appropriate pull requests](https://github.com/microsoft/vscode-docs/pulls) for the [documentation](https://code.visualstudio.com/docs/python/python-tutorial) -- including the [WOW](https://code.visualstudio.com/docs/languages/python) page -- are ready
-   [ ] Final updates to the `release-YYYY.minor` branch
    -   [ ] Create a branch against `release-YYYY.minor` for a pull request
    -   [ ] Update the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) to remove the `-rc` (🤖)
    -   [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) is up-to-date (the only update should be the version number if `package-lock.json` has been kept up-to-date) (🤖)
        -   [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/main/CHANGELOG.md) (🤖)
            -   [ ] Update version and date for the release section
            -   [ ] Run [`news`](https://github.com/Microsoft/vscode-python/tree/main/news) and copy-and-paste new entries (typically `python news --final | code-insiders -`; quite possibly nothing new to add)
    -   [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/main/ThirdPartyNotices-Distribution.txt) by using https://tools.opensource.microsoft.com/notice (🤖; see team notes)
        -   [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/main/ThirdPartyNotices-Repository.txt) manually if necessary
        -   [ ] Create pull request against `release-YYYY.minor` (🤖)
        -   [ ] Merge pull request into `release-YYYY.minor`

## Release

-   [ ] Make sure [CI](https://github.com/microsoft/vscode-python/actions?query=workflow%3A%22Insiders+Build%22) is passing (🤖)
-   [ ] Create a [GitHub release](https://github.com/microsoft/vscode-python/releases) (🤖)
    -   [ ] Start creating a new release
    -   [ ] Make the tag match the version of the released extension
    -   [ ] Copy the changelog entry into the release as the description
-   [ ] Run the CD pipeline
-   [ ] Publish [documentation changes](https://github.com/Microsoft/vscode-docs/pulls?q=is%3Apr+is%3Aopen+label%3Apython)
-   [ ] Publish the [blog](http://aka.ms/pythonblog) post
-   [ ] Determine if a hotfix is needed
-   [ ] Merge the release branch back into `main`. Don't overwrite the main branch version. (🤖)


## Prep for the _next_ release

-   [ ] Create a new [release plan](https://raw.githubusercontent.com/microsoft/vscode-python/main/.github/release_plan.md) (🤖)
-   [ ] [(Un-)pin](https://help.github.com/en/articles/pinning-an-issue-to-your-repository) [release plan issues](https://github.com/Microsoft/vscode-python/labels/release%20plan) (🤖)
