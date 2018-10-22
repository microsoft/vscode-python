# Beta (Monday the week prior to release)

- [ ] Update the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json)
- [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json) is up-to-date
- [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md)
   - Create a new section for this release
   - Run [`news`](https://github.com/Microsoft/vscode-python/tree/master/news) (typically `python news | code-insiders -`)
   - Touch up news entries (and corresponding news entry files)
   - Copy over the "Thanks" section from the previous release
- [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Distribution.txt)
   - Run [`tpn`](https://github.com/Microsoft/vscode-python/tree/master/tpn) (typically `python tpn --npm package-lock.json --config tpn/distribution.toml ThirdPartyNotices-Distribution.txt`)
   - Register any Python changes with [OSPO](https://opensource.microsoft.com/)
- [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Repository.txt) and register any changes with OSPO
- [ ] Open appropriate [documentation issues](https://github.com/microsoft/vscode-docs/issues?q=is%3Aissue+is%3Aopen+label%3Apython)


# Release candidate (Monday before release)

- [ ] Announce feature freeze
- [ ] Ensure all new feature usages are tracked via telemetry
- [ ] Update the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json)
- [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json) is up-to-date
- [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md)
   - Update version and date for the release section
   - Run [`news`](https://github.com/Microsoft/vscode-python/tree/master/news) (typically `python news --final | code-insiders -`)
   - Touch up news entries (and corresponding news entry files)
   - Check that the "Thanks" section is up-to-date
- [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Distribution.txt)
   - Run [`tpn`](https://github.com/Microsoft/vscode-python/tree/master/tpn) (typically `python tpn --npm package-lock.json --config tpn/distribution.toml ThirdPartyNotices-Distribution.txt`)
   - Register any Python changes with [OSPO](https://opensource.microsoft.com/)
- [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Repository.txt) and register any changes with OSPO
- [ ] Merge into the [`release` branch](https://github.com/microsoft/vscode-python/tree/release)
- [ ] Open appropriate [documentation issues](https://github.com/microsoft/vscode-docs/issues?q=is%3Aissue+is%3Aopen+label%3Apython)
- [ ] Begin drafting a [blog](http://aka.ms/pythonblog) post


# Final (near a VS Code release)

## Preparation
[Final PR should be against the `release` branch and then cherrypicked into `master`]

- [ ] Make sure no extraneous files are being included in the `.vsix` file (make sure to check for hidden files)
- [ ] Make sure the [appropriate pull requests](https://github.com/microsoft/vscode-docs/pulls) for the [documentation](https://code.visualstudio.com/docs/python/python-tutorial) -- including the [WOW](https://code.visualstudio.com/docs/languages/python) page -- are ready
- [ ] Update the version in [`package.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json)
- [ ] Run `npm install` to make sure [`package-lock.json`](https://github.com/Microsoft/vscode-python/blob/master/package.json) is up-to-date (the only update should be the version number if `package-lock.json` has been kept up-to-date)
- [ ] Update [`CHANGELOG.md`](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md)
   - Update version and date for the release section
   - Run [`news`](https://github.com/Microsoft/vscode-python/tree/master/news) (typically `python news --final | code-insiders -`)
   - Check that the "Thanks" section is up-to-date
- [ ] Update [`ThirdPartyNotices-Distribution.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Distribution.txt)
   - Run [`tpn`](https://github.com/Microsoft/vscode-python/tree/master/tpn) (typically `python tpn --npm package-lock.json --config tpn/distribution.toml ThirdPartyNotices-Distribution.txt`)
   - Register any Python changes with [OSPO](https://opensource.microsoft.com/)
- [ ] Update [`ThirdPartyNotices-Repository.txt`](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Repository.txt) and register any changes with OSPO

## Release

- [ ] Make sure [CI](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING.md) is passing
- [ ] Generate the final `.vsix` file
- [ ] Upload the final `.vsix` file to the [marketplace](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
- [ ] Publish [documentation](https://code.visualstudio.com/docs/python/python-tutorial) [changes](https://github.com/microsoft/vscode-docs/pulls)
- [ ] Publish the [blog](http://aka.ms/pythonblog) post
- [ ] Create a [release](https://github.com/Microsoft/vscode-python/releases) on GitHub (which creates an appropriate git tag)
- [ ] Determine if a hotfix is needed

## Prep for the _next_ release
- [ ] Bump the [version](https://github.com/Microsoft/vscode-python/blob/master/package.json) number to the next `alpha`
- [ ] Lift the feature freeze
- [ ] Create a new [release plan](https://github.com/Microsoft/vscode-python/edit/master/.github/release_plan.md)

## Clean up after _this_ release
- [ ] Clean up any straggling [fixed issues needing validation](https://github.com/Microsoft/vscode-python/issues?q=label%3A%22validate+fix%22+is%3Aclosed)
- [ ] Go through [`needs more info` issues](https://github.com/Microsoft/vscode-python/issues?q=is%3Aopen+label%3A%22needs+more+info%22+sort%3Aupdated-asc) and close any that have no activity for over a month
