# Packaged release compatibility (report only)

This checks **installed final VSIX contents**, not a development checkout of Python or Python Environments. Existing source CI, native PET tests, and smoke tests remain unchanged. The new check addresses the narrower release gap: exercising an exact packaged pair with Environments explicitly on and explicitly off, including Windows.

Production defaults, extension dependencies, PET bundling policy, and the supported opt-out are not changed. The deployed Environments-on default is the primary path; explicit false remains a required regression case.

## Runner contract

From the repository, restore the existing lockfile with `npm ci`. Run guard tests with `npm run test:releaseCompatibility`. The standalone harness uses Node 22 or newer and supports Windows x64 and Linux x64.

```powershell
node .\build\releaseCompatibility\run.js --plan C:\test-inputs\plan.json --output C:\test-evidence\new-run
```

The output must be a **new** directory. It is never cleared or reused. Artifact paths are local, resolved relative to the plan; there are no Marketplace/latest downloads inside each case. VS Code is downloaded once at the exact version in the plan into the isolated output directory.

```json
{
    "schemaVersion": 1,
    "candidate": "core",
    "vscodeVersion": "<exact major.minor.patch>",
    "pythonExecutable": "C:\\Python\\python.exe",
    "core": {
        "path": "candidate-core-win32-x64.vsix",
        "version": "<exact extension version>",
        "sha256": "<64 hex characters>"
    },
    "environments": {
        "path": "released-environments-win32-x64.vsix",
        "version": "<one fixed supported released version>",
        "sha256": "<64 hex characters>",
        "pet": "bundled"
    }
}
```

Resolve partner versions, platform assets, and hashes once when preparing the release input set. Substitute the placeholders above; they are deliberately not runnable defaults. `candidate` may also be `environments` for the companion repository's adapter. Optional per-artifact `provenance` is retained, with absent metadata recorded as unknown; descriptive metadata alone is **not** an authenticated producer attestation.

Core must contain its platform PET. Environments must match its declared `pet: "bundled"` or `"omitted"` in the actual archive. Both VSIX and package manifests must agree on identity, version, and x64 target. Archive extraction rejects traversal, symlinks, ambiguous Windows names, encryption, duplicate names, and unsupported compression. Expanded bytes are streamed and bounded before buffering, including data-descriptor entries; declared sizes cannot bypass the actual-byte limits.

For the DevDiv cutover, supply `upgradeFromEnvironments` with the same artifact fields and `pet: "bundled"`, and set the final Environments artifact to `pet: "omitted"`. Both packages must be original official packaging outputs. Do not remove PET from an existing VSIX or inject a locally built replacement to manufacture a passing pair.

Each boolean mode gets its own workspace, user-data directory, home, extension directory, and VS Code process. Settings are written **before host launch**. Two real `venv --without-pip` fixtures are created as direct workspace children, within the legacy locator's two-directory search depth, and their actual executable/prefix verified. The controller requires discovery of both fixtures before selecting each and invoking normal `python.execInTerminal`; observed candidates are retained even on failure. The script atomically writes a nonce, `sys.executable`, and `sys.prefix`; a terminal appearing or a command resolving is not a pass.

Only the independent test controller is an `extensionDevelopmentPath`. Its own public `ExtensionContext` must report test mode for single-phase checks, or development mode for real-storage upgrade hosts. Products must load from the exact installed VSIX directories, outside that sole development root, with the expected identities/versions. The public `Extension` object does not expose another extension's context mode; it remains unknown rather than fabricating a `Production` value. Installed-path and controller-only launch evidence prove these are not source/development-extension runs. A transparent, restored observer of the public Environments `runInTerminal` method proves core's on-mode delegation without replacing execution. Prototype methods are shadowed only on the instance and restored by removing the shadow; shared prototypes are never modified. An immutable API that cannot be observed is an explicit infrastructure error, not a pass.

For an upgrade, both phases use normal isolated VS Code hosts **without `--extensionTestsPath`**: [VS Code deliberately uses in-memory storage during extension tests](https://github.com/microsoft/vscode/blob/0870c2a0c7c0564e7631bfed2675573a94ba4455/src/vs/platform/storage/electron-main/storageMainService.ts#L99-L102). The independent controller runs on normal development-extension activation and requests a graceful quit after writing its report. The baseline fully exits before replacing only the installed Environments directory. Workspace settings, user profile, and selection storage are retained. An independent controller-owned global/workspace Memento token must survive the restart; failure is an infrastructure/storage error, not a product association verdict. The upgraded host must observe the last selected fixture **before any product selection write**, and explicit true/false must survive. Neither the probe nor the runner reseeds product selection. An unsuccessful baseline cannot certify an upgrade.

## Evidence and isolation

`report.json` records `passed`, `failed`, or `infrastructure-error`; CLI exit codes are 0, 1, and 2 respectively. Planned cases that could not run are explicit `not-run` records. Phase reports retain discovery, configuration, selection/delegation, real execution JSON, and process output. Raw extension-host logs remain in the isolated profile.

The selected PET comes from the **actual locator startup log**, not merely package presence. On mode uses Environments' own PET when bundled, otherwise core's; off mode verifies core's PET when the native backend runs. Supported Core releases can instead use the legacy JavaScript locators in off mode; this requires positive Core discovery-log evidence plus the same successful real fixture discovery/execution checks, and records PET runtime identity as not started/unknown rather than inventing a binary or forcing an experiment. Missing on-mode PET evidence, an unexpected opt-out Environments startup, or unobserved discovery backend still fails. Observed native paths/hashes must match the installed VSIX. Original installed files and input VSIX hashes are checked again. Optional `pet --version` information remains explicitly unavailable if unsupported; no invented supplier version floor is applied.

Candidate processes receive an allowlisted OS environment and isolated home/config/temp directories. Signing/publishing tokens, OAuth tokens, `NODE_OPTIONS`, `NODE_PATH`, `PYTHONPATH`, and developer test switches are not inherited. No developer VS Code profile is modified and no existing application processes are killed. Cleanup addresses only owned POSIX process groups or a private Windows kill-on-close job assigned before the child resumes, retaining ownership after a parent exits. Linux group completion is checked even on successful root exit, including redirected-stdio descendants, before accepting shutdown or upgrading; forced owned-descendant cleanup is recorded. Cleanup and report settlement are bounded; failures remain explicit.

## Immutable harness handoff

```powershell
npm run package:releaseCompatibility -- C:\test-inputs\harness.zip
```

The packer uses the repository's restored, locked dependencies. It emits a ZIP with `run.js` at its root, the controller, required runtime dependency tree, source/dependency hashes, and the producer lockfile. It does not include product source as an extension. Consumers must pin the **whole ZIP SHA-256** before extraction/execution. No dependency restore, `NODE_PATH`, floating branch, personal fork, or unmerged source lookup is required in a candidate job.

The read-only `Packaged compatibility guards` GitHub workflow automatically runs the guard/adapter/packer suite on Windows and Linux when the harness, its pipeline/workflow, or dependency/Node inputs change. It also executes the frozen released Core 2026.10.0 / Environments 1.42.0 pair on VS Code 1.110.0 in real clean on/off hosts, using the exact platform asset hashes in `released-pairs.json`, and retains raw pass/failure/infrastructure evidence without uploading the whole editor cache. It uploads the immutable harness ZIP from that exact CI run. This validates the runner beyond isolated guards, but is **not** official candidate, no-PET upgrade, or final signed-publication certification; it adds no branch-protection or publishing rule.

The existing PR/CI workflow also runs `Candidate Core packaged compatibility` after its unchanged `build-vsix` job. It downloads that **same workflow run's original** `ms-python-insiders-vsix-win32-x64` / `-linux-x64` artifact, requires the one exact expected VSIX, and passes it as the optional third input to `selfTest.js` (`output`, `python`, `candidate VSIX`). This orchestration reuses the fixed released Environments 1.42.0 preparation and the unchanged packaged runner. It reads the candidate version and SHA from the original archive, records producer run/artifact/source/head provenance, and never rebuilds the extension or replaces/injects PET. Both on/off hosts must discover/switch/execute the real fixtures. Missing candidate inputs fail explicitly rather than falling back to the released Core. These read-only jobs validate the current **CI-built candidate**, not the official CD/signing output; existing source-built PET policy, legacy checks, production defaults and release gates are unchanged.

## Core release adapter and remaining acceptance

`build/azure-pipeline.release-compatibility.yml` is an **opt-in, separate, pre-sign Build-artifact report pipeline**. It can consume either stable or prerelease official core output, selected by exact existing definition/build/artifact/file, version, and hash in the pipeline's **current project** (`System.TeamProject`). This allows a DevDiv-hosted consumer as well as the existing Monaco project, without cross-project credentials or a guessed core DevDiv publishing graph. The artifact name is a required input, not inferred from an unpublished template.

Provide a hash-pinned `inputs.zip` in an exact same-project producer run's `python-compatibility-inputs` artifact. Its root `inputs.json` contains `schemaVersion: 1`, the exact `vscodeVersion`, and the fixed `environments` artifact fields; companion VSIX files are relative inside the ZIP. Optional `upgradeFromEnvironments` uses the same shape. `prepare.js` checks the input archive and creates the normal runner plan using the exact downloaded core VSIX and the agent-selected Python.

The report job contains no signing, feed authentication, publishing, or approval steps. Nonzero runner results remain observable (`continueOnError` only makes this report-only); initialization/download/restore failures retain an infrastructure report. Existing stable human approval and prerelease publishing behavior remain intact.

**Not yet a release certification or a post-sign gate:** the checked-in core definitions extend shared publishing templates, and no verified core DevDiv publishing graph/post-Sign hook is added here. Hosted owners must run/validate this new pipeline with actual artifact permissions, retain evidence, and reconcile the tested VSIX SHA-256 with the final signed/published VSIX **without rebuilding**. Detached-signature packaging must be verified to preserve the exact bytes. These cases must not be certified from local YAML parsing or a released-package walkthrough.

Core stable currently obtains PET from Monaco definition 593 using a release branch; prerelease uses definition 591/latest. This contribution records the resulting packaged binary identity but does not silently change producer selection or add cross-project credentials. Resolving one trusted producer build before all packaging targets, and adding a final post-sign consumer with the shared-template owners, remain explicit release-owner handoff items rather than guessed pipeline wiring.
