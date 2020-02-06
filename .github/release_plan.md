# Prerequisites

* Python 3.7 and higher
* run `python3 -m pip install --user -r news/requirements.txt`
* run `python3 -m pip install --user -r tpn/requirements.txt`


# Release candidate (Monday, XXX XX)

- [ ] Announce the code freeze (not just to team but also to ptvsd and language server)
- [ ] Update master for the release
   - [ ] Create a branch against `master` for a pull request
   - [ ] Change the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json) from a `-dev` suffix to `-rc` (🤖)
   - [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json) is up-to-date (🤖)
   - [ ] Update `requirements.txt` to point to latest release version of [ptvsd](https://github.com/microsoft/ptvsd).
   - [ ] Update `languageServerVersion` in `package.json` to point to the latest version (???) of [the Language Server](https://github.com/Microsoft/python-language-server).
   - [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md) (🤖)
      - [ ] Run [`news`](https://github.com/Microsoft/vscode-python/tree/master/news) (typically `python news --final --update CHANGELOG.md | code-insiders -`)
      - [ ] Copy over the "Thanks" section from the previous release
      - [ ] Make sure the "Thanks" section is up-to-date (e.g. compare to versions in requirements.json)
      - [ ] Touch up news entries (e.g. add missing periods)
      - [ ] Check the Markdown rendering to make sure everything looks good
      - [ ] Add any relevant news entries for ptvsd and the language server if they were updated
   - [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Distribution.txt) by running [`tpn`](https://github.com/Microsoft/vscode-python/tree/master/tpn) (typically `python tpn --npm package-lock.json --npm-overrides package.datascience-ui.dependencies.json --config tpn/distribution.toml ThirdPartyNotices-Distribution.txt`)
      * for each failure:
         1. go to the repo (from link on NPM page) and look for the license there
         1. copy the text from the failure into `tpn/distribution.toml`
         1. fill in the license found in the package's repo
      * if there is no license in a package's repo then do one of the following:
         + check the NPM metadata and fill in the corresponding license from the OSI site
         + ask the package maintainer (e.g. via github)
         + ask CELA
   - [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Repository.txt) as appropriate
   - [ ] Create a pull request against `master` (🤖)
   - [ ] Merge pull request into `master`
- [ ] Update the [`release` branch](https://github.com/microsoft/vscode-python/branches)
   - [ ] Delete the `release` branch in the repo
   - [ ] Create a new `release` branch from `master`
   - (alternately, force-push the master branch to the GitHub "release" branch)
   - [ ] (if necessary) Request that the branch be set anew as "protected"
- [ ] Update master post-release (🤖)
   - [ ] Bump the version number to the next monthly ("YYYY.M.0-dev") release in the `master` branch
      - [ ] `package.json`
      - [ ] `package-lock.json`
   - [ ] Create a pull request against `master`
   - [ ] Merge pull request into `master`
- [ ] Announce the code freeze is over
- [ ] Update [Component Governance](https://dev.azure.com/ms/vscode-python/_componentGovernance) (Click on "microsoft/vscode-python" on that page)
  - [ ] Provide details for any automatically detected npm dependencies
  - [ ] Manually add any repository dependencies
- [ ] GDPR bookkeeping (@brettcannon) (🤖)
- [ ] Open appropriate [documentation issues](https://github.com/microsoft/vscode-docs/issues?q=is%3Aissue+is%3Aopen+label%3Apython)
   + new features
   + settings changes
   + etc. (ask the team)
- [ ] Begin drafting a [blog](http://aka.ms/pythonblog) post
- [ ] Ask CTI to test the release candidate


# Final (Monday, XXX XX)

## Preparation

- [ ] Make sure the [appropriate pull requests](https://github.com/microsoft/vscode-docs/pulls) for the [documentation](https://code.visualstudio.com/docs/python/python-tutorial) -- including the [WOW](https://code.visualstudio.com/docs/languages/python) page -- are ready
- [ ] final updates to the `release` branch
   - [ ] Create a branch against `release` for a pull request
   - [ ] Update the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json) (🤖)
   - [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json) is up-to-date (the only update should be the version number if `package-lock.json` has been kept up-to-date) (🤖)
   - [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md) (🤖)
      - [ ] Update version and date for the release section
      - [ ] Run [`news`](https://github.com/Microsoft/vscode-python/tree/master/news) and copy-and-paste new entries (typically `python news --final | code-insiders -`; quite possibly nothing new to add)
   - [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Distribution.txt) by running [`tpn`](https://github.com/Microsoft/vscode-python/tree/master/tpn) (typically `python tpn --npm package-lock.json --npm-overrides package.datascience-ui.dependencies.json --config tpn/distribution.toml ThirdPartyNotices-Distribution.txt`; quite possible there will be no change) (🤖)
   - [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Repository.txt) manually if necessary
   - [ ] Create pull request against `release` (🤖)
   - [ ] Merge pull request into `release`
- [ ] Make sure component governance is happy

## Release

- [ ] Publish the release via Azure DevOps
   - [ ] Make sure [CI](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING.md) is passing
   - [ ] Make sure the "Upload" stage on the release page succeeded
   - [ ] Make sure no extraneous files are being included in the `.vsix` file (make sure to check for hidden files)
   - [ ] Deploy the "Publish" stage
- [ ] Publish [documentation changes](https://github.com/Microsoft/vscode-docs/pulls?q=is%3Apr+is%3Aopen+label%3Apython)
- [ ] Publish the [blog](http://aka.ms/pythonblog) post
- [ ] Determine if a hotfix is needed
- [ ] Merge `release` back into `master` (🤖)

## Clean up after _this_ release
- [ ] Go through [`info needed` issues](https://github.com/Microsoft/vscode-python/issues?q=is%3Aopen+label%3A%22info+needed%22+-label%3A%22data+science%22+sort%3Aupdated-asc) and close any that have no activity for over a month (🤖)
- [ ] GDPR bookkeeping (🤖)

## Prep for the _next_ release
- [ ] Create a new [release plan](https://raw.githubusercontent.com/microsoft/vscode-python/master/.github/release_plan.md) (🤖)
- [ ] [(Un-)pin](https://help.github.com/en/articles/pinning-an-issue-to-your-repository) [release plan issues](https://github.com/Microsoft/vscode-python/labels/release%20plan) (🤖)
