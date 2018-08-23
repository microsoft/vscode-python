# Week of Monday, XXX

- [ ] Review the state of the current [milestone](https://github.com/Microsoft/vscode-python/milestones)
- [ ] Go through telemetry for GDPR
- [ ] Go through all [merged pull requests](https://github.com/Microsoft/vscode-python/pulls?utf8=%E2%9C%93&q=is%3Apr+is%3Amerged) and add the [`validate fix` label](https://github.com/Microsoft/vscode-python/labels/validate%20fix) as appropriate as well as checking for news entries
- [ ] Validate [fixed issues](https://github.com/Microsoft/vscode-python/issues?q=label%3A%22validate+fix%22+is%3Aclosed)
- [ ] Triage [unverified issues](https://github.com/Microsoft/vscode-python/labels/needs%20verification)
- [ ] Update pre-existing dependencies as appropriate (npm, Python, git submodule, or otherwise; requires updating CELA)

## Planning
- [ ] Evaluate if TypeScript usage needs updating to sync with VS Code's usage
- [ ] Evaluate [projects](https://github.com/Microsoft/vscode-python/projects) & [`meta` issues](https://github.com/Microsoft/vscode-python/labels/meta)
- [ ] Go through [`needs PR` issues](https://github.com/Microsoft/vscode-python/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3A%22needs+PR%22+-label%3A%22help+wanted%22+-label%3A%22good+first+issue%22+no%3Amilestone) to see if there's anything we want to add to this milestone
- [ ] Finalize the initial set of issues for the [milestone](https://github.com/Microsoft/vscode-python/milestones)
- [ ] Close issues that have [needed more info](https://github.com/Microsoft/vscode-python/issues?q=is%3Aopen+label%3A%22needs+more+info%22+sort%3Aupdated-asc) for over a month

# Week of Monday, XXX

- [ ] Review the state of the current [milestone](https://github.com/Microsoft/vscode-python/milestones)
- [ ] Go through telemetry for GDPR
- [ ] Go through all [merged pull requests](https://github.com/Microsoft/vscode-python/pulls?utf8=%E2%9C%93&q=is%3Apr+is%3Amerged) and add the [`validate fix` label](https://github.com/Microsoft/vscode-python/labels/validate%20fix) as appropriate as well as checking for news entries
- [ ] Validate [fixed issues](https://github.com/Microsoft/vscode-python/issues?q=label%3A%22validate+fix%22+is%3Aclosed)
- [ ] Triage [unverified issues](https://github.com/Microsoft/vscode-python/labels/needs%20verification)

## Planning
- [ ] Check if there have been no performance regressions
- [ ] Read through [VS Code's iteration plan](https://github.com/Microsoft/vscode/labels/iteration-plan) (it may still be a [draft](https://github.com/Microsoft/vscode/labels/iteration-plan-draft))

# Week of Monday, XXX

- [ ] Review the state of the current [milestone](https://github.com/Microsoft/vscode-python/milestones)
- [ ] Go through telemetry for GDPR
- [ ] Go through all [merged pull requests](https://github.com/Microsoft/vscode-python/pulls?utf8=%E2%9C%93&q=is%3Apr+is%3Amerged) and add the [`validate fix` label](https://github.com/Microsoft/vscode-python/labels/validate%20fix) as appropriate as well as checking for news entries
- [ ] Validate [fixed issues](https://github.com/Microsoft/vscode-python/issues?q=label%3A%22validate+fix%22+is%3Aclosed)
- [ ] Triage [unverified issues](https://github.com/Microsoft/vscode-python/labels/needs%20verification)

## Legal
- [ ] Announce the lock-down of dependencies for this release
- [ ] Notify CELA of all changes to the [repository](https://github.com/Microsoft/vscode-python/tree/master/pythonFiles), [distribution dependencies](https://github.com/Microsoft/vscode-python/blob/master/package.json) (including [ptvsd](https://pypi.org/project/ptvsd/) as necessary

## Release a beta version for testing
- [ ] Update the [version](https://github.com/Microsoft/vscode-python/blob/master/package.json) to be a `beta` & update the [changelog](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md)
- [ ] Announce the beta [development build](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING.md#development-build) (along with how to help [validate fixes](https://github.com/Microsoft/vscode-python/issues?q=label%3A%22validate+fix%22+is%3Aclosed))
- [ ] Open appropriate [documentation issues](https://github.com/microsoft/vscode-docs/issues?q=is%3Aissue+is%3Aopen+label%3Apython)

# Week of Monday, XXX

- [ ] Review the state of the current [milestone](https://github.com/Microsoft/vscode-python/milestones)
- [ ] Go through telemetry for GDPR
- [ ] Merge any last-minute [pull requests](https://github.com/Microsoft/vscode-python/pulls)
- [ ] Go through all [merged pull requests](https://github.com/Microsoft/vscode-python/pulls?utf8=%E2%9C%93&q=is%3Apr+is%3Amerged) and add the [`validate fix` label](https://github.com/Microsoft/vscode-python/labels/validate%20fix) as appropriate as well as checking for news entries
- [ ] Validate [fixed issues](https://github.com/Microsoft/vscode-python/issues?q=label%3A%22validate+fix%22+is%3Aclosed)
- [ ] Triage [unverified issues](https://github.com/Microsoft/vscode-python/labels/needs%20verification)

## Prep for the release candidate
- [ ] Announce feature freeze
- [ ] Make sure the [repo](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Repository.txt) and [distribution TPNs](https://github.com/Microsoft/vscode-python/blob/master/ThirdPartyNotices-Distribution.txt) have been updated appropriately

## Test the release candidate code
- [ ] Update the [version](https://github.com/Microsoft/vscode-python/blob/master/package.json) to be an `rc` & update the [changelog](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md)
- [ ] Announce the release candidate [development build](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING.md#development-build)
- [ ] Open appropriate [documentation issues](https://github.com/microsoft/vscode-docs/issues?q=is%3Aissue+is%3Aopen+label%3Apython)
- [ ] Begin drafting a [blog](http://aka.ms/pythonblog) post

## Prep the release
- [ ] Ensure all new feature usages are tracked via telemetry
- [ ] Make sure no extraneous files are being included in the `.vsix` file (make sure to check for hidden files)
- [ ] Make sure the [appropriate pull requests](https://github.com/microsoft/vscode-docs/pulls) for the [documentation](https://code.visualstudio.com/docs/python/python-tutorial) -- including the [WOW](https://code.visualstudio.com/docs/languages/python) page -- are ready

## Release
- [ ] Update the [changelog](https://github.com/Microsoft/vscode-python/blob/master/CHANGELOG.md) (including the names of external contributors & projects)
- [ ] Update the [version](https://github.com/Microsoft/vscode-python/blob/master/package.json) number to be final
- [ ] Make sure [CI](https://github.com/Microsoft/vscode-python/blob/master/CONTRIBUTING.md) is passing
- [ ] Generate the final `.vsix` file
- [ ] Upload the final `.vsix` file to the [marketplace](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
- [ ] Publish [documentation](https://code.visualstudio.com/docs/python/python-tutorial) [changes](https://github.com/microsoft/vscode-docs/pulls)
- [ ] Publish the [blog](http://aka.ms/pythonblog) post
- [ ] Create a [release](https://github.com/Microsoft/vscode-python/releases) on GitHub (which creates an appropriate git tag)
- [ ] Determine if a hotfix is needed
- [ ] Create the `release-` [branch](https://github.com/Microsoft/vscode-python/)

## Prep for the _next_ release
- [ ] Bump the [version](https://github.com/Microsoft/vscode-python/blob/master/package.json) number to the next `alpha`
- [ ] Make sure the next **two** [milestones](https://github.com/Microsoft/vscode-python/milestones) exist
- [ ] Lift the feature freeze
- [ ] Create a new [release plan](https://github.com/Microsoft/vscode-python/edit/master/.github/release_plan.md)

## Clean up after _this_ release
- [ ] Clean up any straggling [fixed issues needing validation](https://github.com/Microsoft/vscode-python/issues?q=label%3A%22validate+fix%22+is%3Aclosed)
- [ ] Close the (now) old [milestone](https://github.com/Microsoft/vscode-python/milestones)
- [ ] Delete the previous releases' [branch](https://github.com/Microsoft/vscode-python/branches)
- [ ] Go through [`needs more info` issues](https://github.com/Microsoft/vscode-python/issues?q=is%3Aopen+label%3A%22needs+more+info%22+sort%3Aupdated-asc) and close any that have no activity for over a month
