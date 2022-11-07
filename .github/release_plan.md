All dates should align with VS Code's [iteration](https://github.com/microsoft/vscode/labels/iteration-plan) and [endgame](https://github.com/microsoft/vscode/labels/endgame-plan) plans.

# Feature freeze (Monday @ 17:00 America/Vancouver, XXX XX)

-   [ ] Announce the feature freeze on both Teams and e-mail, leave enough time for teams to surface any last minute issues that need to get in before freeze. Make sure debugger and Language Server teams are looped in as well.

# Release candidate (Monday, XXX XX)

NOTE: Third Party Notices are automatically added by our build pipelines using https://tools.opensource.microsoft.com/notice.

-   [ ] Update `main` for the release
    -   [ ] Change the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) to the next **even** number and switch the `-dev` to `-rc` (🤖)
    -   [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) is up-to-date, you should now see changes to the`package.json` and `package-lock.json` (🤖)
    -   [ ] Check [`pypi.org`](https://pypi.org/search/?q=debugpy) and update the version of `debugpy` in `install_debugpy.py` if necessary.
    -   [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/main/ThirdPartyNotices-Repository.txt) as appropriate. This file is manually edited so you can check with the teams if anything needs to be added here.
    -   [ ] Get approval on PR then merge pull request into `main`
-   [ ] Create the [`release` branch](https://github.com/microsoft/vscode-python/branches)
    -   [ ] If there are `release` branches that are two versions old you can delete them at this time
    -   [ ] Click `draft new release` then create a tag for this release matching the `release/YYYY.XX` format
    -   [ ] Click `generate release notes`
    -   [ ] Create a new `release/YYYY.XX` branch from `main`
-   [ ] Create a draft [GitHub release](https://github.com/microsoft/vscode-python/releases) for the release notes (🤖)
-   [ ] Update `main` post-release (🤖)
    -   [ ] Bump the minor version number to the next ("YYYY.[minor+1]") release in the `main` branch to an **odd** number and switch the `-rc` to `-dev`(🤖)
    -   [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/main/package.json) is up-to-date, you should now see changes to the`package.json` and `package-lock.json` (🤖)
    -   [ ] Create a pull request against `main`
    -   [ ] Get approval on PR then merge pull request into `main`
-   [ ] Announce the code freeze is over on the same channels, not required if this occurs on normal release cadence
-   [ ] Update Component Governance (Notes are in the team OneNote under Python VS Code → Dev Process → Component Governance).
    -   [ ] Check pipeline on Azure DevOps under [`monacotools/Monaco/Compliance/Component Governance`](https://dev.azure.com/monacotools/Monaco/_componentGovernance/192726?_a=alerts&typeId=11825783&alerts-view-option=active)
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
    -   [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/main/ThirdPartyNotices-Repository.txt) manually if necessary
    -   [ ] Create pull request against `release/YYYY.minor` (🤖)
    -   [ ] Merge pull request into `release/YYYY.minor`

## Release

-   [ ] Make sure [CI](https://github.com/microsoft/vscode-python/actions?query=workflow:%22Build%22) is passing for Release branch (🤖).
-   [ ] Run the [CD](https://dev.azure.com/monacotools/Monaco/_build?definitionId=299) pipeline on the `release/yyyy.minor` branch.
-   [ ] Check to ensure VS Code release has gone out before moving onto publishing the python extension
    -   [ ] Press the approve button if everything looks good to publish to market place.
-   [ ] Create a [GitHub release](https://github.com/microsoft/vscode-python/releases) (🤖)
    -   [ ] Update the release notes
    -   [ ] Take the release out of draft
-   [ ] Publish [documentation changes](https://github.com/Microsoft/vscode-docs/pulls?q=is%3Apr+is%3Aopen+label%3Apython)
-   [ ] Publish the [blog](http://aka.ms/pythonblog) post
-   [ ] Determine if a hotfix is needed
-   [ ] Merge the release branch back into `main`. Don't overwrite the main branch version. (🤖)

## Prep for the _next_ release

-   [ ] Create a new [release plan](https://raw.githubusercontent.com/microsoft/vscode-python/main/.github/release_plan.md) (🤖)
-   [ ] [(Un-)pin](https://help.github.com/en/articles/pinning-an-issue-to-your-repository) [release plan issues](https://github.com/Microsoft/vscode-python/labels/release%20plan) (🤖)
