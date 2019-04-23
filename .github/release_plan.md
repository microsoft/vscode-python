# Release candidate (Tuesday, XXX XX)

- [ ] Ensure all new features are tracked via telemetry
- [ ] Announce the code freeze (not just to team but also to ptvsd and language server)
- [ ] Create a branch against `master` for a pull request
- [ ] Update the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json)
- [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json) is up-to-date
- [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md)
   - [ ] Create a new section for this release
   - [ ] Copy over the "Thanks" section from the previous release and make sure it's up-to-date
   - [ ] Run [`news`](https://github.com/Microsoft/vscode-python/tree/master/news) (typically `python news --final --update CHANGELOG.md | code-insiders -`)
   - [ ] Touch up news entries
   - [ ] Add any relevant news entries for ptvsd and the language server if they were updated
- [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Distribution.txt) by running [`tpn`](https://github.com/Microsoft/vscode-python/tree/master/tpn) (typically `python tpn --npm package-lock.json --npm-overrides package.datascience-ui.dependencies.json --config tpn/distribution.toml ThirdPartyNotices-Distribution.txt`)
- [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Repository.txt) as appropriate
- [ ] Create a pull request against `master`
- [ ] Merge pull request into `master`
- [ ] Delete the `release` branch in the repo
- [ ] Create a new `release` branch from `master`
- [ ] Bump the version number to the next release in the `master` branch
  - [ ] `package.json`
  - [ ] `package-lock.json`
- [ ] Announce the code freeze is over
- [ ] Update [Component Governance](https://dev.azure.com/ms/vscode-python/)
  - [ ] Provide details for any automatically detected npm dependencies
  - [ ] Manually add any repository dependencies
- [ ] GDPR bookkeeping
- [ ] Open appropriate [documentation issues](https://github.com/microsoft/vscode-docs/issues?q=is%3Aissue+is%3Aopen+label%3Apython)
- [ ] Begin drafting a [blog](http://aka.ms/pythonblog) post
- [ ] Ask CTI to test the release candidate


# Final (Tuesday, XXX XX)

## Preparation

- [ ] Make sure the [appropriate pull requests](https://github.com/microsoft/vscode-docs/pulls) for the [documentation](https://code.visualstudio.com/docs/python/python-tutorial) -- including the [WOW](https://code.visualstudio.com/docs/languages/python) page -- are ready
- [ ] Create a branch against `release` for a pull request
- [ ] Update the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json)
- [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json) is up-to-date (the only update should be the version number if `package-lock.json` has been kept up-to-date)
- [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md)
   - [ ] Update version and date for the release section
   - [ ] Run [`news`](https://github.com/Microsoft/vscode-python/tree/master/news) and copy-and-paste new entries (typically `python news --final | code-insiders -`; quite possibly nothing new to add)
- [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Distribution.txt) by running [`tpn`](https://github.com/Microsoft/vscode-python/tree/master/tpn) (typically `python tpn --npm package-lock.json --npm-overrides package.datascience-ui.dependencies.json --config tpn/distribution.toml ThirdPartyNotices-Distribution.txt`; quite possible there will be no change)
- [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Repository.txt) manually if necessary
- [ ] Create pull request against `release`
- [ ] Merge pull request into `release`
- [ ] Make sure component governance is happy

## Release

- [ ] Make sure [CI](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING.md) is passing
- [ ] Generate the final `.vsix` file
- [ ] Make sure no extraneous files are being included in the `.vsix` file (make sure to check for hidden files)
- [ ] Upload the final `.vsix` file to the [marketplace](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
- [ ] Publish [documentation changes](https://github.com/microsoft/vscode-docs/pulls)
- [ ] Publish the [blog](http://aka.ms/pythonblog) post
- [ ] Create a [release](https://github.com/Microsoft/vscode-python/releases) on GitHub (which creates an appropriate git tag)
- [ ] Determine if a hotfix is needed
- [ ] Merge `release` back into `master`

## Prep for the _next_ release
- [ ] Create a new [release plan](https://github.com/Microsoft/vscode-python/edit/master/.github/release_plan.md)
- [ ] [(Un-)pin](https://help.github.com/en/articles/pinning-an-issue-to-your-repository) [release plan issues](https://github.com/Microsoft/vscode-python/labels/release%20plan)

## Clean up after _this_ release
- [ ] Go through [`info needed` issues](https://github.com/Microsoft/vscode-python/issues?q=is%3Aopen+label%3A%22info+needed%22+sort%3Acreated-asc) and close any that have no activity for over a month
- [ ] GDPR bookkeeping
