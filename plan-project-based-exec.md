# Plan: Project-Based Pytest Execution

## Overview

This plan describes the implementation of **project-based test execution for pytest**, enabling multi-project workspace support where each Python project within a workspace can execute tests using its own Python environment. This builds on top of the project-based discovery work from PR #25760.

## Problem to Solve

In a multi-project workspace (e.g., a monorepo with multiple Python services), users currently cannot:
- Run tests with the correct Python interpreter for each project
- Have separate test trees per project in the Test Explorer
- Properly handle nested projects (parent/child)

## Architecture

### Key Components to Add

| Component               | File                                                                                         | Purpose                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **TestProjectRegistry** | [testProjectRegistry.ts](../src/client/testing/testController/common/testProjectRegistry.ts) | Registry that discovers and manages Python projects per workspace           |
| **ProjectAdapter**      | [projectAdapter.ts](../src/client/testing/testController/common/projectAdapter.ts)           | Interface representing a single Python project with its test infrastructure |
| **projectUtils**        | [projectUtils.ts](../src/client/testing/testController/common/projectUtils.ts)               | Utility functions for project ID generation and adapter creation            |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Workspace                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    TestController                           ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │              TestProjectRegistry                      │  ││
│  │  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  ││
│  │  │   │ ProjectA    │  │ ProjectB    │  │ ProjectC    │   │  ││
│  │  │   │ (Py 3.11)   │  │ (Py 3.12)   │  │ (Py 3.10)   │   │  ││
│  │  │   │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │   │  ││
│  │  │   │ │Discovery│ │  │ │Discovery│ │  │ │Discovery│ │   │  ││
│  │  │   │ │Adapter  │ │  │ │Adapter  │ │  │ │Adapter  │ │   │  ││
│  │  │   │ ├─────────┤ │  │ ├─────────┤ │  │ ├─────────┤ │   │  ││
│  │  │   │ │Execution│ │  │ │Execution│ │  │ │Execution│ │   │  ││
│  │  │   │ │Adapter  │ │  │ │Adapter  │ │  │ │Adapter  │ │   │  ││
│  │  │   │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │   │  ││
│  │  │   └─────────────┘  └─────────────┘  └─────────────┘   │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Execution Flow

1. **User runs tests** → `TestRunRequest` with selected `TestItem`s arrives
2. **Controller** checks if project-based testing is enabled
3. **Group tests by project** → Tests are sorted by which `ProjectAdapter` they belong to (via URI matching)
4. **Execute per project** → Each project's `executionAdapter.runTests()` is called with:
   - The project's Python environment
   - `PROJECT_ROOT_PATH` environment variable set to project root
5. **Results collected** → Each project's `resultResolver` maps results back to test items

### Required Changes by File

#### Controller ([controller.ts](../src/client/testing/testController/controller.ts))
- Add `TestProjectRegistry` integration
- New methods: `discoverForProject()`, `executeTestsForProjects()`, `groupTestItemsByProject()`
- Debug mode should handle multi-project scenarios by launching multiple debug sessions

#### Pytest Execution Adapter ([pytestExecutionAdapter.ts](../src/client/testing/testController/pytest/pytestExecutionAdapter.ts))
- Add `project?: ProjectAdapter` parameter to `runTests()`
- Set `PROJECT_ROOT_PATH` environment variable when project is provided
- Use project's Python environment instead of workspace environment
- Debug launches should use `pythonPath` from project when available

#### Debug Launcher ([debugLauncher.ts](../src/client/testing/common/debugLauncher.ts))
- Add optional `pythonPath` to `LaunchOptions` for project-specific interpreter
- Add optional `debugSessionName` to `LaunchOptions` for session identification
- Debug sessions should use explicit Python path when provided
- Use unique session markers to track individual debug sessions (avoids `activeDebugSession` race conditions)
- Properly dispose event handlers when debugging completes

#### Python Side ([vscode_pytest/__init__.py](../python_files/vscode_pytest/__init__.py))
- `get_test_root_path()` should return `PROJECT_ROOT_PATH` env var if set (otherwise cwd)
- Session node should use project root for test tree structure

## Feature Behavior

### Single Project Workspace
No change from existing behavior—tests run using the workspace's interpreter.

### Multi-Project Workspace
- Each project has its own root node in Test Explorer
- Running tests uses the correct interpreter for each project
- Results are scoped to the correct project

### Nested Projects
```
workspace/
└── parent-project/
    ├── tests/
    └── child-project/
        └── tests/
```
- Parent project discovery ignores child project via `--ignore` flags
- Execution receives specific test IDs, so no cross-contamination

### Debug Mode
- **Single project**: Debug should proceed normally with project interpreter
- **Multiple projects**: Multiple debug sessions should be launched in parallel—one per project, each using its own interpreter
- **Session naming**: Each debug session includes the project name (e.g., "Debug Tests: alice (Python 3.11)")
- **Session isolation**: Each debug session is tracked independently using unique markers, so stopping one session doesn't affect others

### Cancellation Handling

Cancellation is handled at multiple levels to ensure proper cleanup across all parallel project executions:

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Clicks "Stop"                           │
│                           │                                     │
│                           ▼                                     │
│              CancellationToken fires                            │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│   ┌───────────┐    ┌───────────┐    ┌───────────┐               │
│   │ Project A │    │ Project B │    │ Project C │               │
│   │ Execution │    │ Execution │    │ Execution │               │
│   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘               │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│   Kill subprocess  Kill subprocess  Kill subprocess             │
│   Close pipes      Close pipes      Close pipes                 │
│   Resolve deferred Resolve deferred Resolve deferred            │
└─────────────────────────────────────────────────────────────────┘
```

#### Cancellation Levels

1. **Project execution level** ([projectTestExecution.ts](src/client/testing/testController/common/projectTestExecution.ts))
   - Early exit if cancelled before starting
   - Checks cancellation before starting each project's execution
   - Projects not yet started are skipped gracefully

2. **Execution adapter level** ([pytestExecutionAdapter.ts](src/client/testing/testController/pytest/pytestExecutionAdapter.ts))
   - `runInstance.token.onCancellationRequested` kills the subprocess
   - Named pipe server is closed via the callback
   - Deferred promises resolve to unblock waiting code

3. **Debug launcher level** ([debugLauncher.ts](src/client/testing/common/debugLauncher.ts))
   - Token cancellation resolves the deferred and invokes cleanup callback
   - Session termination events are filtered to only react to the correct session
   - Event handlers are disposed when debugging completes

#### Multi-Session Debug Independence

When debugging multiple projects simultaneously, each `launchDebugger()` call must track its own debug session independently. The implementation uses a unique marker system:

```typescript
// Each debug session gets a unique marker in its configuration
const sessionMarker = `test-${Date.now()}-${random}`;
launchArgs[TEST_SESSION_MARKER_KEY] = sessionMarker;

// When sessions start/terminate, we match by marker (not activeDebugSession)
onDidStartDebugSession((session) => {
    if (session.configuration[TEST_SESSION_MARKER_KEY] === sessionMarker) {
        ourSession = session;  // Found our specific session
    }
});
```

This avoids race conditions where the global `activeDebugSession` could be overwritten by another concurrent session start.

### Legacy Fallback
When Python Environments API is unavailable, the system falls back to single-workspace adapter mode.

## Files to Change

| Category                | Files                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Core Implementation** | `controller.ts`, `testProjectRegistry.ts`, `projectAdapter.ts`, `projectUtils.ts`, `projectTestExecution.ts` |
| **Adapters**            | `pytestExecutionAdapter.ts`, `pytestDiscoveryAdapter.ts`, `resultResolver.ts`                                |
| **Types**               | `types.ts` (common), `types.ts` (testController)                                                             |
| **Debug**               | `debugLauncher.ts`                                                                                           |
| **Python**              | `vscode_pytest/__init__.py`                                                                                  |
| **Tests**               | `controller.unit.test.ts`, `testProjectRegistry.unit.test.ts`, `projectUtils.unit.test.ts`                   |

## Testing

### Unit Tests to Add
- `testProjectRegistry.unit.test.ts` - Registry lifecycle, project discovery, nested projects
- `controller.unit.test.ts` - Controller integration, debug scenarios, test grouping
- `projectUtils.unit.test.ts` - Utility functions

### Test Scenarios to Cover
| Scenario                      | Coverage                                      |
| ----------------------------- | --------------------------------------------- |
| Single project workspace      | Unit tests + legacy flows                     |
| Multi-project workspace       | New controller unit tests                     |
| Nested projects               | Discovery tests + ignore behavior             |
| Debug mode (single project)   | Existing debug tests                          |
| Debug mode (multi-project)    | Session isolation, independent cancellation   |
| Legacy fallback               | Existing controller tests                     |
| Test cancellation             | Cancellation at all levels (see above)        |

## Out of Scope
- **Unittest support**: Project-based unittest execution will be handled in a separate PR
- **End-to-end tests**: Manual testing will be required for full validation
- **Multi-project coverage aggregation**: Deferred to future work

## Expected User Experience

### Debugging Across Multiple Projects
When debugging tests spanning multiple projects:
- Multiple debug sessions should be launched simultaneously—one per project
- Each debug session should use the project's configured Python interpreter
- All projects' tests should run in debug mode in parallel
- Users should be able to switch between debug sessions in VS Code's debug panel
- **Stopping one debug session should NOT affect other running sessions**
- Each debug session is named with its project (e.g., "Debug Tests: alice (Python 3.11)")
