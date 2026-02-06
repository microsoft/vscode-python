---
applyTo: 'src/client/testing/**'
---

# Testing feature area — Discovery, Run, Debug, and Results

This document maps the testing support in the extension: discovery, execution (run), debugging, result reporting and how those pieces connect to the codebase. It's written for contributors and agents who need to navigate, modify, or extend test support (both `unittest` and `pytest`).

## Overview

-   Purpose: expose Python tests in the VS Code Test Explorer (TestController), support discovery, run, debug, and surface rich results and outputs.
-   Scope: provider-agnostic orchestration + provider-specific adapters, TestController mapping, IPC with Python-side scripts, debug launch integration, and configuration management.

## High-level architecture

-   Controller / UI bridge: orchestrates TestController requests and routes them to workspace adapters.
-   Workspace adapter: provider-agnostic coordinator that translates TestController requests to provider adapters and maps payloads back into TestItems/TestRuns.
-   Provider adapters: implement discovery/run/debug for `unittest` and `pytest` by launching Python scripts and wiring named-pipe IPC.
-   Result resolver: translates Python-side JSON/IPCPayloads into TestController updates (start/pass/fail/output/attachments).
-   Debug launcher: prepares debug sessions and coordinates the debugger attach flow with the Python runner.

## Key components (files and responsibilities)

-   Entrypoints
    -   `src/client/testing/testController/controller.ts` — `PythonTestController` (main orchestrator).
    -   `src/client/testing/serviceRegistry.ts` — DI/wiring for testing services.
-   Workspace orchestration
    -   `src/client/testing/testController/workspaceTestAdapter.ts` — `WorkspaceTestAdapter` (provider-agnostic entry used by controller).
-   **Project-based testing (multi-project workspaces)**
    -   `src/client/testing/testController/common/testProjectRegistry.ts` — `TestProjectRegistry` (manages project lifecycle, discovery, and nested project handling).
    -   `src/client/testing/testController/common/projectAdapter.ts` — `ProjectAdapter` interface (represents a single Python project with its own test infrastructure).
    -   `src/client/testing/testController/common/projectUtils.ts` — utilities for project ID generation, display names, and shared adapter creation.
-   Provider adapters
    -   Unittest
        -   `src/client/testing/testController/unittest/testDiscoveryAdapter.ts`
        -   `src/client/testing/testController/unittest/testExecutionAdapter.ts`
    -   Pytest
        -   `src/client/testing/testController/pytest/pytestDiscoveryAdapter.ts`
        -   `src/client/testing/testController/pytest/pytestExecutionAdapter.ts`
-   Result resolution and helpers
    -   `src/client/testing/testController/common/resultResolver.ts` — `PythonResultResolver` (maps payload -> TestController updates).
    -   `src/client/testing/testController/common/testItemUtilities.ts` — helpers for TestItem lifecycle.
    -   `src/client/testing/testController/common/types.ts` — `ITestDiscoveryAdapter`, `ITestExecutionAdapter`, `ITestResultResolver`, `ITestDebugLauncher`.
    -   `src/client/testing/testController/common/debugLauncher.ts` — debug session creation helper.
    -   `src/client/testing/testController/common/utils.ts` — named-pipe helpers and command builders (`startDiscoveryNamedPipe`, etc.).
-   Configuration
    -   `src/client/testing/common/testConfigurationManager.ts` — per-workspace test settings.
    -   `src/client/testing/configurationFactory.ts` — configuration service factory.
-   Utilities & glue
    -   `src/client/testing/utils.ts` — assorted helpers used by adapters.
    -   Python-side scripts: `python_files/unittestadapter/*`, `python_files/pytestadapter/*` — discovery/run code executed by adapters.

## Python subprocess runners (what runs inside Python)

The adapters in the extension don't implement test discovery/run logic themselves — they spawn a Python subprocess that runs small helper scripts located under `python_files/` and stream structured events back to the extension over the named-pipe IPC. This is a central part of the feature area; changes here usually require coordinated edits in both the TypeScript adapters and the Python scripts.

-   Unittest helpers (folder: `python_files/unittestadapter`)

    -   `discovery.py` — performs `unittest` discovery and emits discovery payloads (test suites, cases, locations) on the IPC channel.
    -   `execution.py` / `django_test_runner.py` — run tests for `unittest` and, where applicable, Django test runners; emit run events (start, stdout/stderr, pass, fail, skip, teardown) and attachment info.
    -   `pvsc_utils.py`, `django_handler.py` — utility helpers used by the runners for environment handling and Django-specific wiring.
    -   The adapter TypeScript files (`testDiscoveryAdapter.ts`, `testExecutionAdapter.ts`) construct the command line, start a named-pipe listener, and spawn these Python scripts using the extension's ExecutionFactory (activated interpreter) so the scripts execute inside the user's selected environment.

-   Pytest helpers (folder: `python_files/vscode_pytest`)

    -   `_common.py` — shared helpers for pytest runner scripts.
    -   `run_pytest_script.py` — the primary pytest runner used for discovery and execution; emits the same structured IPC payloads the extension expects (discovery events and run events).
    -   The `pytest` execution adapter (`pytestExecutionAdapter.ts`) and discovery adapter build the CLI to run `run_pytest_script.py`, start the pipe, and translate incoming payloads via `PythonResultResolver`.

-   IPC contract and expectations

    -   Adapters rely on a stable JSON payload contract emitted by the Python scripts: identifiers for tests, event types (discovered, collected, started, passed, failed, skipped), timings, error traces, and optional attachments (logs, captured stdout/stderr, file links).
    -   The extension maps these payloads to `TestItem`/`TestRun` updates via `PythonResultResolver` (`src/client/testing/testController/common/resultResolver.ts`). If you change payload shape, update the resolver and tests concurrently.

-   How the subprocess is started
    -   Execution adapters use the extension's `ExecutionFactory` (preferred) to get an activated interpreter and then spawn a child process that runs the helper script. The adapter will set up environment variables and command-line args (including the pipe name / run-id) so the Python runner knows where to send events and how to behave (discovery vs run vs debug).
    -   For debug sessions a debug-specific entry argument/port is passed and `common/debugLauncher.ts` coordinates starting a VS Code debug session that will attach to the Python process.

## Core functionality (what to change where)

-   Discovery
    -   Entry: `WorkspaceTestAdapter.discoverTests` → provider discovery adapter. Adapter starts a named-pipe listener, spawns the discovery script in an activated interpreter, forwards discovery events to `PythonResultResolver` which creates/updates TestItems.
    -   Files: `workspaceTestAdapter.ts`, `*DiscoveryAdapter.ts`, `resultResolver.ts`, `testItemUtilities.ts`.
-   Run / Execution
    -   Entry: `WorkspaceTestAdapter.executeTests` → provider execution adapter. Adapter spawns runner in an activated env, runner streams run events to the pipe, `PythonResultResolver` updates a `TestRun` with start/pass/fail and attachments.
    -   Files: `workspaceTestAdapter.ts`, `*ExecutionAdapter.ts`, `resultResolver.ts`.
-   Debugging
    -   Flow: debug request flows like a run but goes through `debugLauncher.ts` to create a VS Code debug session with prepared ports/pipes. The Python runner coordinates attach/continue with the debugger.
    -   Files: `*ExecutionAdapter.ts`, `common/debugLauncher.ts`, `common/types.ts`.
-   Result reporting
    -   `resultResolver.ts` is the canonical place to change how JSON payloads map to TestController constructs (messages, durations, error traces, attachments).

## Typical workflows (short)

-   Full discovery

    1. `PythonTestController` triggers discovery -> `WorkspaceTestAdapter.discoverTests`.
    2. Provider discovery adapter starts pipe and launches Python discovery script.
    3. Discovery events -> `PythonResultResolver` -> TestController tree updated.

-   Run tests

    1. Controller collects TestItems -> creates `TestRun`.
    2. `WorkspaceTestAdapter.executeTests` delegates to execution adapter which launches the runner.
    3. Runner events arrive via pipe -> `PythonResultResolver` updates `TestRun`.
    4. On process exit the run is finalized.

-   Debug a test
    1. Debug request flows to execution adapter.
    2. Adapter prepares ports and calls `debugLauncher` to start a VS Code debug session with the run ID.
    3. Runner coordinates with the debugger; `PythonResultResolver` still receives and applies run events.

## Tests and examples to inspect

-   Unit/integration tests for adapters and orchestration under `src/test/` (examples):
    -   `src/test/testing/common/testingAdapter.test.ts`
    -   `src/test/testing/testController/workspaceTestAdapter.unit.test.ts`
    -   `src/test/testing/testController/unittest/testExecutionAdapter.unit.test.ts`
    -   Adapter tests demonstrate expected telemetry, debug-launch payloads and result resolution.

## History & evolution (brief)

-   Migration to TestController API: the code organizes around VS Code TestController, mapping legacy adapter behaviour into TestItems/TestRuns.
-   Named-pipe IPC: discovery/run use named-pipe IPC to stream events from Python runner scripts (`python_files/*`) which enables richer, incremental updates and debug coordination.
-   Environment activation: adapters prefer the extension ExecutionFactory (activated interpreter) to run discovery and test scripts.

## Pointers for contributors (practical)

-   To extend discovery output: update the Python discovery script in `python_files/*` and `resultResolver.ts` to parse new payload fields.
-   To change run behaviour (args/env/timouts): update the provider execution adapter (`*ExecutionAdapter.ts`) and add/update tests under `src/test/`.
-   To change debug flow: edit `common/debugLauncher.ts` and adapters' debug paths; update tests that assert launch argument shapes.

## Django support (how it works)

-   The extension supports Django projects by delegating discovery and execution to Django-aware Python helpers under `python_files/unittestadapter`.
    -   `python_files/unittestadapter/django_handler.py` contains helpers that invoke `manage.py` for discovery or execute Django test runners inside the project context.
    -   `python_files/unittestadapter/django_test_runner.py` provides `CustomDiscoveryTestRunner` and `CustomExecutionTestRunner` which integrate with the extension by using the same IPC contract (they use `UnittestTestResult` and `send_post_request` to emit discovery/run payloads).
-   How adapters pass Django configuration:
    -   Execution adapters set environment variables (e.g. `MANAGE_PY_PATH`) and modify `PYTHONPATH` so Django code and the custom test runner are importable inside the spawned subprocess.
    -   For discovery the adapter may run the discovery helper which calls `manage.py test` with a custom test runner that emits discovery payloads instead of executing tests.
-   Practical notes for contributors:
    -   Changes to Django discovery/execution often require edits in both `django_test_runner.py`/`django_handler.py` and the TypeScript adapters (`testDiscoveryAdapter.ts` / `testExecutionAdapter.ts`).
    -   The Django test runner expects `TEST_RUN_PIPE` environment variable to be present to send IPC events (see `django_test_runner.py`).

## Settings referenced by this feature area

-   The extension exposes several `python.testing.*` settings used by adapters and configuration code (declared in `package.json`):
    -   `python.testing.pytestEnabled`, `python.testing.unittestEnabled` — enable/disable frameworks.
    -   `python.testing.pytestPath`, `python.testing.pytestArgs`, `python.testing.unittestArgs` — command path and CLI arguments used when spawning helper scripts.
    -   `python.testing.cwd` — optional working directory used when running discovery/runs.
    -   `python.testing.autoTestDiscoverOnSaveEnabled`, `python.testing.autoTestDiscoverOnSavePattern` — control automatic discovery on save.
    -   `python.testing.debugPort` — default port used for debug runs.
    -   `python.testing.promptToConfigure` — whether to prompt users to configure tests when potential test folders are found.
-   Where to look in the code:
    -   Settings are consumed by `src/client/testing/common/testConfigurationManager.ts`, `src/client/testing/configurationFactory.ts`, and adapters under `src/client/testing/testController/*` which read settings to build CLI args and env for subprocesses.
    -   The setting definitions and descriptions are in `package.json` and localized strings in `package.nls.json`.

## Project-based testing (multi-project workspaces)

Project-based testing enables multi-project workspace support where each Python project gets its own test tree root with its own Python environment.

### Architecture

-   **TestProjectRegistry** (`testProjectRegistry.ts`): Central registry that:

    -   Discovers Python projects via the Python Environments API
    -   Creates and manages `ProjectAdapter` instances per workspace
    -   Computes nested project relationships and configures ignore lists
    -   Falls back to "legacy" single-adapter mode when API unavailable

-   **ProjectAdapter** (`projectAdapter.ts`): Interface representing a single project with:
    -   Project identity (ID, name, URI from Python Environments API)
    -   Python environment with execution details
    -   Test framework adapters (discovery/execution)
    -   Nested project ignore paths (for parent projects)

### How it works

1. **Activation**: When the extension activates, `PythonTestController` checks if the Python Environments API is available.
2. **Project discovery**: `TestProjectRegistry.discoverAndRegisterProjects()` queries the API for all Python projects in each workspace.
3. **Nested handling**: `configureNestedProjectIgnores()` identifies child projects and adds their paths to parent projects' ignore lists.
4. **Test discovery**: For each project, the controller calls `project.discoveryAdapter.discoverTests()` with the project's URI. The adapter sets `PROJECT_ROOT_PATH` environment variable for the Python runner.
5. **Python side**:
    - For pytest: `get_test_root_path()` in `vscode_pytest/__init__.py` returns `PROJECT_ROOT_PATH` (if set) or falls back to `cwd`.
    - For unittest: `discovery.py` uses `PROJECT_ROOT_PATH` as `top_level_dir` and `project_root_path` to root the test tree at the project directory.
6. **Test tree**: Each project gets its own root node in the Test Explorer, with test IDs scoped by project ID using the `@@vsc@@` separator (defined in `projectUtils.ts`).

### Nested project handling: pytest vs unittest

**pytest** supports the `--ignore` flag to exclude paths during test collection. When nested projects are detected, parent projects automatically receive `--ignore` flags for child project paths. This ensures each test appears under exactly one project in the test tree.

**unittest** does not support path exclusion during `discover()`. Therefore, tests in nested project directories may appear under multiple project roots (both the parent and the child project). This is **expected behavior** for unittest:

-   Each project discovers and displays all tests it finds within its directory structure
-   There is no deduplication or collision detection
-   Users may see the same test file under multiple project roots if their project structure has nesting

This approach was chosen because:

1. unittest's `TestLoader.discover()` has no built-in path exclusion mechanism
2. Implementing custom exclusion would add significant complexity with minimal benefit
3. The existing approach is transparent and predictable - each project shows what it finds

### Empty projects and root nodes

If a project discovers zero tests, its root node will still appear in the Test Explorer as an empty folder. This ensures consistent behavior and makes it clear which projects were discovered, even if they have no tests yet.

### Logging prefix

All project-based testing logs use the `[test-by-project]` prefix for easy filtering in the output channel.

### Key files

-   Python side:
    -   `python_files/vscode_pytest/__init__.py` — `get_test_root_path()` function and `PROJECT_ROOT_PATH` environment variable for pytest.
    -   `python_files/unittestadapter/discovery.py` — `discover_tests()` with `project_root_path` parameter and `PROJECT_ROOT_PATH` handling for unittest discovery.
    -   `python_files/unittestadapter/execution.py` — `run_tests()` with `project_root_path` parameter and `PROJECT_ROOT_PATH` handling for unittest execution.
-   TypeScript: `testProjectRegistry.ts`, `projectAdapter.ts`, `projectUtils.ts`, and the discovery/execution adapters.

### Tests

-   `src/test/testing/testController/common/testProjectRegistry.unit.test.ts` — TestProjectRegistry tests
-   `src/test/testing/testController/common/projectUtils.unit.test.ts` — Project utility function tests
-   `python_files/tests/pytestadapter/test_discovery.py` — pytest PROJECT_ROOT_PATH tests (see `test_project_root_path_env_var()` and `test_symlink_with_project_root_path()`)
-   `python_files/tests/unittestadapter/test_discovery.py` — unittest `project_root_path` / PROJECT_ROOT_PATH discovery tests
-   `python_files/tests/unittestadapter/test_execution.py` — unittest `project_root_path` / PROJECT_ROOT_PATH execution tests
-   `src/test/testing/testController/unittest/testDiscoveryAdapter.unit.test.ts` — unittest discovery adapter PROJECT_ROOT_PATH tests
-   `src/test/testing/testController/unittest/testExecutionAdapter.unit.test.ts` — unittest execution adapter PROJECT_ROOT_PATH tests

## Coverage support (how it works)

-   Coverage is supported by running the Python helper scripts with coverage enabled and then collecting a coverage payload from the runner.
    -   Pytest-side coverage logic lives in `python_files/vscode_pytest/__init__.py` (checks `COVERAGE_ENABLED`, imports `coverage`, computes per-file metrics and emits a `CoveragePayloadDict`).
    -   Unittest adapters enable coverage by setting environment variable(s) (e.g. `COVERAGE_ENABLED`) when launching the subprocess; adapters and `resultResolver.ts` handle the coverage profile kind (`TestRunProfileKind.Coverage`).
-   Flow summary:
    1. User starts a Coverage run via Test Explorer (profile kind `Coverage`).
    2. Controller/adapters set `COVERAGE_ENABLED` (or equivalent) in the subprocess env and invoke the runner script.
    3. The Python runner collects coverage (using `coverage` or `pytest-cov`), builds a file-level coverage map, and sends a coverage payload back over the IPC.
    4. `PythonResultResolver` (`src/client/testing/testController/common/resultResolver.ts`) receives the coverage payload and stores `detailedCoverageMap` used by the TestController profile to show file-level coverage details.
-   Tests that exercise coverage flows are under `src/test/testing/*` and `python_files/tests/*` (see `testingAdapter.test.ts` and adapter unit tests that assert `COVERAGE_ENABLED` is set appropriately).

## Interaction with the VS Code API

-   TestController API
    -   The feature area is built on VS Code's TestController/TestItem/TestRun APIs (`vscode.tests.createTestController` / `tests.createTestController` in the code). The controller creates a `TestController` in `src/client/testing/testController/controller.ts` and synchronizes `TestItem` trees with discovery payloads.
    -   `PythonResultResolver` maps incoming JSON events to VS Code API calls: `testRun.appendOutput`, `testRun.passed/failed/skipped`, `testRun.end`, and `TestItem` updates (labels, locations, children).
-   Debug API
    -   Debug runs use the Debug API to start an attach/launch session. The debug launcher implementation is in `src/client/testing/testController/common/debugLauncher.ts` which constructs a debug configuration and calls the VS Code debug API to start a session (e.g. `vscode.debug.startDebugging`).
    -   Debug adapter/resolver code in the extension's debugger modules may also be used when attaching to Django or test subprocesses.
-   Commands and configuration
    -   The Test Controller wires commands that appear in the Test Explorer and editor context menus (see `package.json` contributes `commands`) and listens to configuration changes filtered by `python.testing` in `src/client/testing/main.ts`.
-   The "Copy Test ID" command (`python.copyTestId`) can be accessed from both the Test Explorer context menu (`testing/item/context`) and the editor gutter icon context menu (`testing/item/gutter`). This command copies test identifiers to the clipboard in the appropriate format for the active test framework (pytest path format or unittest module.class.method format).
-   Execution factory & activated environments
    -   Adapters use the extension `ExecutionFactory` to spawn subprocesses in an activated interpreter (so the user's venv/conda is used). This involves the extension's internal environment execution APIs and sometimes `envExt` helpers when the external environment extension is present.

## Learnings

-   Never await `showErrorMessage()` calls in test execution adapters as it blocks the test UI thread and freezes the Test Explorer (1)
-   VS Code test-related context menus are contributed to using both `testing/item/context` and `testing/item/gutter` menu locations in package.json for full coverage (1)

```

```
