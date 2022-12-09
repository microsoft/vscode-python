All dates should align with VS Code's [iteration](https://github.com/microsoft/vscode/labels/iteration-plan) and [endgame](https://github.com/microsoft/vscode/labels/endgame-plan) plans.

# Feature freeze (Monday @ 17:00 America/Vancouver, XXX XX)

-   [ ] Post in the `#python` channel in Slack to notify that the python extension is entering feature freeze. ❄️ (steps with ❄️ will dictate this step happens while main is frozen 🥶)

NOTE: the number of this release is in the issue title and can be substituted in wherever you see [YYYY.minor].


# Release candidate (Monday, XXX XX)

NOTE: Third Party Notices are automatically added by our build pipelines using  https://tools.opensource.microsoft.com/notice.

### Step 1: 
##### Bump the version of `main` to be a release candidate (also updating debugpy dependences, third party notices, and package-lock.json).❄️

-   [ ] `git fetch` to ensure you are up to date with `main` on your local machine.
-   [ ] Create a new branch called  **`bump-release-[YYYY.minor]`**.
-   [ ] Change the version in `package.json` to the next **even** number and switch the `-dev` to `-rc`. (🤖)
-   [ ] Run `npm install` to make sure `package-lock.json` is up-to-date. _(you should now see changes to the `package.json` and `package-lock.json`)_. (🤖)
-   [ ] Check `pypi.org` [here](https://pypi.org/search/?q=debugpy) and update the version of debugpy in `install_debugpy.py` if necessary _(this file can be found in the folder "PythonFiles")_.
-   [ ] Update `ThirdPartyNotices-Repository.txt` as appropriate. You can check by looking [here](https://github.com/microsoft/vscode-python/commits/main) and scroll through the commits to see if there's anything listed there which might have pulled in some code from somewhere else. If you are still unsure you can check with the team. 
-   [ ] Create a PR from your branch  **`bump-release-[YYYY.minor]`** to `main`. Add the `"no change-log"` tag to the PR which ensures it passes CI and does not show up on the release notes.
-   [ ] 🧍🧍 Get approval on this PR then merge this PR into main. This will delete branch **`bump-release-[YYYY.minor]`** as it is no longer needed. (steps with 🧍🧍require an additional person) 

NOTE: this PR will fail the test in CI called `VS Code (pre-release)` because it merges a release candidate into `main`. This is ok- you will merge a failing PR but fix it in step 4 below by returing `main` back to a odd number dev version.


### Step 2: Creating your release branch ❄️
-   [ ] Create a release branch by creating a new branch called **`release/YYYY.minor`** branch from `main`. This branch is now the candidate for our release which will be the base from which we will release.

NOTE: If there are release branches that are two versions old you can delete them at this time.

### Step 3 Create a draft GitHub release for the release notes (🤖) ❄️

-   [ ] Go [here](https://github.com/microsoft/vscode-python/releases/new) to create a new GitHub release.
-   [ ] Create a new tag called `YYYY.minor.0`.
-   [ ] Have the `target` for the github release be your release branch called **`release/YYYY.minor`**.
-   [ ] Click `generate release notes` and check that it only contain notes from what is new in this release.
-   [ ] Click `save draft`.

### Step 4: Return `main` to dev and unfreeze (❄️ ➡ 💧)
NOTE: The purpose of this step is ensuring that main always is on a dev version number for every night's 🌃 insiders release. Therefore it is imperative that you do this directly after the previous steps to reset the version in main to a dev version.
-   [ ] Create a branch called **`dev-version-bump-YYYY.[minor+1]`**.
-   [ ] Bump the minor version number in the package.json to the next `YYYY.[minor+1]` which will be an odd number and switch the `-rc` to `-dev`.(🤖)
-   [ ] Run `npm install` to make sure `package-lock.json` is up-to-date. _(you should now see changes to the `package.json` and `package-lock.json`.)_ (🤖)
-   [ ] From this branch create a PR against `main`.
-   [ ] 🧍🧍 Get approval on PR then merge pull request into `main`. This will delete branch **`dev-version-bump-YYYY.[minor+1]`** as it is no longer needed.

NOTE: this PR should be passing CI and will return `main` to passing CI from step 1.

### Step 5: Notifications and Checks on External Release Factors
-   [ ] Announce the code freeze is over on the same channels, not required if this occurs on normal release cadence. 
-   [ ] Update Component Governance _(notes are in the team OneNote under Python VS Code → Dev Process → Component Governance)_.
-   [ ] Check pipeline on Azure DevOps under [monacotools/Monaco/Compliance/Component Governance](https://dev.azure.com/monacotools/Monaco/_componentGovernance/192726?_a=alerts&typeId=11825783&alerts-view-option=active) to make sure there are no active alerts.
-   [ ] Manually add any repository/embedded/CG-incompatible dependencies.
-   [ ] Open appropriate [documentation issues](https://github.com/microsoft/vscode-docs/issues?q=is%3Aissue+is%3Aopen+label%3Apython).
-   [ ] Contact the PM team to begin drafting a blog post.


# Release (Wednesday, XXX XX)

### Step 6: Take the release branch from a candidate to the finalized release 
-   [ ] Make sure the [appropriate pull requests](https://github.com/microsoft/vscode-docs/pulls) for the [documentation](https://code.visualstudio.com/docs/python/python-tutorial) -- including the [WOW](https://code.visualstudio.com/docs/languages/python) page -- are ready.
-   [ ] Check to make sure any final updates to the **`release/YYYY.minor`** branch are merge into this branch.
-   [ ] Create a branch against  **`release/YYYY.minor`** called **`finalized-release-[YYYY.minor]`**. 
-   [ ] Update the version in `package.json` to remove the `-rc` (🤖) from the version.
-   [ ] Run `npm install` to make sure `package-lock.json` is up-to-date _(the only update should be the version number if `package-lock.json` has been kept up-to-date)_. (🤖)
-   [ ] Update `ThirdPartyNotices-Repository.txt` manually if necessary.
-   [ ] Create PR from **`finalized-release-[YYYY.minor]`** and ensure it will be merged against the release branch **`release/YYYY.minor`**. (🤖)
-   [ ] 🧍🧍 Get approval on PR then merge the PR into **`release/YYYY.minor`**. This will delete branch **`finalized-release-[YYYY.minor]`** as it is no longer needed.
-   [ ] Merge pull request into the release branch **`release/YYYY.minor`**.


### Step 7: Execute the Release
-   [ ] Make sure CI is passing for **`release-YYYY.minor`** release branch (🤖).
-   [ ] Run the [CD](https://dev.azure.com/monacotools/Monaco/_build?definitionId=299) pipeline on the **`release-YYYY.minor`** branch.
    -   [ ] Click `run pipeline`.
	-   [ ] for `branch/tag` select the release branch which is **`release-YYYY.minor`**.
	-   NOTE: You no longer need to wait for VS Code to release before we since our extension version depends on the VS Code engine number.
-   [ ] 🧍🧍 Get approval on the release on the [CD](https://dev.azure.com/monacotools/Monaco/_build?definitionId=299).
-   [ ] Click "approve" in the publish step of [CD](https://dev.azure.com/monacotools/Monaco/_build?definitionId=299) to publish the release to the marketplace.  🎉 
-   [ ] Take the Github release out of draft.
-   [ ] Publish documentation changes.
-   [ ] Contact the PM team to publish the blog post.
-   [ ] Determine if a hotfix is needed.
-   [ ] Merge the release branch **`release-YYYY.minor`**  back into `main`. (This step is only required if changes were merged into the release branch. If the only change made on the release branch is the version, this is not necessary. Overall you need to ensure you DO NOT overwrite the version on the `main` branch.)

## Prep for the _next_ release

-   [ ] Create a new [release plan](https://raw.githubusercontent.com/microsoft/vscode-python/main/.github/release_plan.md). (🤖)
-   [ ] [(Un-)pin](https://help.github.com/en/articles/pinning-an-issue-to-your-repository) [release plan issues](https://github.com/Microsoft/vscode-python/labels/release%20plan) (🤖)
