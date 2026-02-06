# Test Plan: Project-Based Pytest Execution

This document outlines the testing strategy for the project-based pytest execution feature, including scenarios, edge cases, and test implementations.

## Table of Contents
1. [Overview](#overview)
2. [Test Architecture Summary](#test-architecture-summary)
3. [Unit Tests - New Functions](#unit-tests---new-functions)
4. [Unit Tests - Modified Functions](#unit-tests---modified-functions)
5. [Integration/Higher-Level Tests](#integrationhigher-level-tests)
6. [Edge Cases & Error Scenarios](#edge-cases--error-scenarios)
7. [Implementation Recommendations](#implementation-recommendations)

---

## Overview

The project-based execution feature introduces:
- **`projectTestExecution.ts`** - New file with execution orchestration functions
- **`pytestExecutionAdapter.ts`** - Modified to accept `ProjectAdapter` parameter
- **`debugLauncher.ts`** - New debug session isolation with unique markers
- **`controller.ts`** - Integration point calling `executeTestsForProjects()`

---

## Test Architecture Summary

### Existing Patterns to Reuse

| Pattern | Location | Description |
|---------|----------|-------------|
| TypeMoq mocking | `pytestExecutionAdapter.unit.test.ts` | Mock services, exec factory, debug launcher |
| Sinon stubs for utilities | `workspaceTestAdapter.unit.test.ts` | Stub `util.*` functions |
| Deferred promises | `testCancellationRunAdapters.unit.test.ts` | Test async flows and cancellation |
| TestItem mocking | `testExecutionHandler.unit.test.ts` | Create mock test items with children |
| ProjectAdapter creation | `testProjectRegistry.unit.test.ts` | Mock Python projects and environments |
| Debug service mocking | `debugLauncher.unit.test.ts` | Mock `IDebugService`, session handling |

### Testing Tools Used
- **Mocha** - Test framework (suite/test)
- **TypeMoq** - Interface mocking
- **Sinon** - Stubs, spies, fakes
- **Chai** - Assertions (expect/assert)

---

## Unit Tests - New Functions

### File: `projectTestExecution.unit.test.ts` (NEW)

#### 1. `groupTestItemsByProject()`

**Function Signature:**
```typescript
groupTestItemsByProject(
    testItems: TestItem[],
    projects: ProjectAdapter[]
): Map<string, { project: ProjectAdapter; items: TestItem[] }>
```

**Test Cases:**

| Test Name | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| `should group single item to single project` | 1 test item, 1 project | Map has 1 entry with 1 item |
| `should group multiple items to single project` | 3 items same project | Map has 1 entry with 3 items |
| `should group items across multiple projects` | 3 items, 2 projects | Map has 2 entries, items split correctly |
| `should return empty map when no test items` | 0 items, 2 projects | Empty map |
| `should handle items with no matching project` | Item outside all project paths | Item not included, logged as verbose |
| `should match to most specific project (longest path)` | Nested projects `/a` and `/a/b` | Item in `/a/b/test.py` → project `/a/b` |
| `should handle Windows paths` | `C:\workspace\project` paths | Correct grouping |

**Mock Setup:**
```typescript
// Create mock test items with URIs
function createMockTestItem(id: string, uri: Uri): TestItem {
    return {
        id,
        uri,
        children: { size: 0, forEach: () => {} }
    } as unknown as TestItem;
}

// Create mock ProjectAdapter
function createMockProject(projectPath: string): ProjectAdapter {
    return {
        projectUri: Uri.file(projectPath),
        projectName: path.basename(projectPath),
        // ... other required properties
    } as unknown as ProjectAdapter;
}
```

---

#### 2. `findProjectForTestItem()`

**Test Cases:**

| Test Name | Scenario | Expected |
|-----------|----------|----------|
| `should return undefined for item with no URI` | `item.uri = undefined` | `undefined` |
| `should return project when item path starts with project path` | `/proj/tests/test.py` → `/proj` | Returns project |
| `should return undefined when no project matches` | `/other/test.py` vs `/proj` | `undefined` |
| `should return most specific project for nested paths` | `/ws/a/b/test.py` with projects `/ws/a` and `/ws/a/b` | `/ws/a/b` project |
| `should handle exact path match` | Item at `/proj/test.py`, project at `/proj` | Returns project |

---

#### 3. `getTestCaseNodesRecursive()`

**Test Cases:**

| Test Name | Scenario | Expected |
|-----------|----------|----------|
| `should return single item when no children` | Leaf test case | `[item]` |
| `should return all leaf nodes from nested structure` | File → Class → Methods | All method nodes |
| `should handle deeply nested structure` | 4 levels deep | All leaf nodes |
| `should return empty array for item with empty children` | Item with `children.size = 0` | `[item]` |

**Mock Setup:**
```typescript
function createNestedTestItem(
    id: string,
    childIds: string[]
): TestItem {
    const children = new Map<string, TestItem>();
    childIds.forEach(cid => {
        children.set(cid, createMockTestItem(cid, Uri.file('/test.py')));
    });
    return {
        id,
        uri: Uri.file('/test.py'),
        children: {
            size: children.size,
            forEach: (cb) => children.forEach(cb)
        }
    } as unknown as TestItem;
}
```

---

#### 4. `executeTestsForProject()`

**Test Cases:**

| Test Name | Scenario | Expected |
|-----------|----------|----------|
| `should call executionAdapter.runTests with correct parameters` | Normal execution | Adapter called with projectUri, testIds, project |
| `should mark all test items as started` | 3 test items | `runInstance.started()` called 3 times |
| `should collect testIds from resultResolver.vsIdToRunId` | Test items with mapped IDs | Correct IDs passed to adapter |
| `should handle empty testIds gracefully` | No mapped IDs found | Returns early, logs verbose |
| `should pass project to execution adapter` | Project-based mode | `project` parameter is the ProjectAdapter |

---

#### 5. `executeTestsForProjects()`

**Test Cases:**

| Test Name | Scenario | Expected |
|-----------|----------|----------|
| `should execute tests for multiple projects in parallel` | 3 projects, 9 tests | All 3 executionAdapter.runTests called |
| `should skip execution if cancellation requested before start` | Token cancelled | No adapters called |
| `should skip project if cancellation requested mid-execution` | Cancel after 1st project | 2nd project skipped |
| `should handle empty projects array` | 0 projects | Returns early, logs error |
| `should setup coverage when profile kind is Coverage` | Coverage profile | `loadDetailedCoverage` set on profile |
| `should send telemetry for each project execution` | 2 projects | 2 telemetry events |
| `should continue other projects if one fails` | 1 project throws | Other projects still execute |
| `should not log cancellation as error` | Cancelled during execution | No error logged |

---

#### 6. `setupCoverageForProject()`

**Test Cases:**

| Test Name | Scenario | Expected |
|-----------|----------|----------|
| `should set loadDetailedCoverage on profile` | Coverage profile kind | Function assigned |
| `should do nothing for non-coverage profile` | Run profile kind | No changes to profile |
| `should return details from project.resultResolver.detailedCoverageMap` | Coverage data exists | Returns coverage details |
| `should return empty array when no coverage data` | No data for file | Returns `[]` |

---

## Unit Tests - Modified Functions

### File: `pytestExecutionAdapter.unit.test.ts` (EXTEND)

**New Test Cases:**

| Test Name | Scenario | Expected |
|-----------|----------|----------|
| `should set PROJECT_ROOT_PATH env var when project provided` | Project-based execution | `PROJECT_ROOT_PATH` set to project.projectUri.fsPath |
| `should use project's Python environment when available` | Project with pythonEnv | `execService` created with project's env |
| `should pass debugSessionName in LaunchOptions for debug` | Debug mode with project | `debugSessionName` = project.projectName |
| `should fall back to execFactory when no project environment` | No project.pythonEnvironment | Uses execFactory.createActivatedEnvironment |

**Mock Setup Addition:**
```typescript
const mockProject: ProjectAdapter = {
    projectUri: Uri.file('/workspace/myproject'),
    projectName: 'myproject (Python 3.11)',
    pythonEnvironment: {
        execInfo: { run: { executable: '/usr/bin/python3' } }
    },
    // ... other fields
} as unknown as ProjectAdapter;

// Test with project
adapter.runTests(uri, testIds, kind, testRun, execFactory, debugLauncher, undefined, mockProject);
```

---

### File: `debugLauncher.unit.test.ts` (EXTEND)

**New Test Cases for Session Isolation:**

| Test Name | Scenario | Expected |
|-----------|----------|----------|
| `should add unique session marker to launch config` | Any debug launch | `config[TEST_SESSION_MARKER_KEY]` is unique |
| `should only terminate matching session on callback` | Multiple sessions | Only session with matching marker terminates |
| `should use debugSessionName in config name when provided` | `options.debugSessionName` set | `config.name` includes session name |
| `should use pythonPath when provided` | `options.pythonPath` set | `config.python` = pythonPath |
| `should handle parallel debug sessions independently` | 2 concurrent launches | Each completes independently |
| `should dispose listener when session terminates` | Session ends | `onDidTerminateDebugSession` listener disposed |
| `should resolve deferred on matching session termination` | Correct session ends | Promise resolves |
| `should not resolve deferred on non-matching session termination` | Different session ends | Promise still pending |

**Mock Setup for Parallel Sessions:**
```typescript
test('should handle parallel debug sessions independently', async () => {
    const sessions: DebugSession[] = [];
    let terminateCallback: (session: DebugSession) => void;

    debugService
        .setup(d => d.startDebugging(typemoq.It.isAny(), typemoq.It.isAny(), undefined))
        .callback((_, config) => {
            const mockSession = {
                id: `session-${sessions.length}`,
                configuration: config
            };
            sessions.push(mockSession);
        })
        .returns(() => Promise.resolve(true));

    debugService
        .setup(d => d.onDidTerminateDebugSession(typemoq.It.isAny()))
        .callback((cb) => { terminateCallback = cb; })
        .returns(() => ({ dispose: () => {} }));

    // Launch two sessions in parallel
    const launch1 = debugLauncher.launchDebugger(options1);
    const launch2 = debugLauncher.launchDebugger(options2);

    // Terminate first session
    terminateCallback(sessions[0]);

    // Verify only first resolved
    await launch1; // Should resolve
    // launch2 should still be pending
});
```

---

## Integration/Higher-Level Tests

### File: `projectBasedExecution.integration.test.ts` (NEW)

These tests verify the complete flow from controller through to execution adapters.

#### Test Suite: Multi-Project Workspace Execution

| Test Name | Scenario | Verifications |
|-----------|----------|---------------|
| `should discover and execute tests across 3 projects` | Multi-project workspace | Each project's adapter called with correct tests |
| `should use correct Python environment per project` | Projects with different Pythons | Environment matches project config |
| `should handle mixed test selection across projects` | 2 tests from proj1, 1 from proj2 | Correct grouping and execution |
| `should isolate results per project` | Results from multiple projects | ResultResolver receives per-project data |

#### Test Suite: Debug Mode Multi-Project

| Test Name | Scenario | Verifications |
|-----------|----------|---------------|
| `should launch separate debug session per project` | 2 projects in debug mode | 2 debug sessions started |
| `should name debug sessions with project names` | Debug with named projects | Session names include project names |
| `should allow stopping one session without affecting others` | Stop project A | Project B continues |
| `should handle debug session errors per project` | One project fails to debug | Other projects still debug |

#### Test Suite: Cancellation Flow

| Test Name | Scenario | Verifications |
|-----------|----------|---------------|
| `should cancel all projects when token cancelled` | Cancel mid-run | All projects stop gracefully |
| `should not start pending projects after cancellation` | Cancel after 1 project | Remaining projects not started |
| `should propagate cancellation to debug sessions` | Cancel during debug | Debug sessions terminate |
| `should cleanup named pipes on cancellation` | Cancel during execution | Server disposed, pipes cleaned |

---

### File: `controller.unit.test.ts` (EXTEND)

**New Test Cases:**

| Test Name | Scenario | Expected |
|-----------|----------|----------|
| `should call executeTestsForProjects when projects registered` | Project-based mode | `executeTestsForProjects()` called |
| `should fall back to legacy execution when no projects` | Legacy mode | `workspaceTestAdapter.executeTests()` called |
| `should pass correct dependencies to executeTestsForProjects` | Valid deps | pythonExecFactory, debugLauncher, registry passed |

---

## Edge Cases & Error Scenarios

### Edge Case Matrix

| Category | Edge Case | Test Location | Expected Behavior |
|----------|-----------|---------------|-------------------|
| **Empty Input** | No test items selected | `executeTestsForProjects` | Returns early, no errors |
| **Empty Input** | No projects in registry | `executeTestsForProjects` | Logs error, returns early |
| **Empty Input** | Test items with no URIs | `findProjectForTestItem` | Returns undefined, item skipped |
| **Path Matching** | Nested projects (parent/child) | `groupTestItemsByProject` | Uses most specific match |
| **Path Matching** | Sibling projects | `groupTestItemsByProject` | Correct assignment |
| **Path Matching** | Windows vs Unix paths | `findProjectForTestItem` | Handles both |
| **Cancellation** | Cancelled before start | `executeTestsForProjects` | Immediate return |
| **Cancellation** | Cancelled mid-project | `executeTestsForProject` | Stops gracefully |
| **Cancellation** | Cancelled during debug | `debugLauncher` | Session terminated |
| **Debug Sessions** | Multiple simultaneous | `debugLauncher` | Independent isolation |
| **Debug Sessions** | One fails to start | `executeTestsForProjects` | Others continue |
| **Debug Sessions** | Session terminated externally | `debugLauncher` | Deferred resolves |
| **Environment** | Project missing Python env | `pytestExecutionAdapter` | Falls back to workspace env |
| **Environment** | Invalid Python path | `pytestExecutionAdapter` | Error reported |
| **Results** | Mixed pass/fail across projects | `executeTestsForProjects` | All results processed |
| **Results** | One project times out | `executeTestsForProjects` | Others complete |

### Error Scenarios

| Error Type | Test | Expected Outcome |
|------------|------|------------------|
| Adapter throws exception | `executeTestsForProject` catches | Error logged, other projects continue |
| Debug launcher rejects | `executeTestsForProjects` | Error logged, not cancellation error |
| Named pipe fails | `pytestExecutionAdapter` | Test run fails gracefully |
| Result resolver not found | `executeTestsForProject` | Test IDs empty, returns early |

---

## Implementation Recommendations

### 1. New Test File Structure

```
src/test/testing/testController/
├── common/
│   ├── projectTestExecution.unit.test.ts  <-- NEW
│   ├── testProjectRegistry.unit.test.ts   (existing, extend if needed)
│   └── projectUtils.unit.test.ts          (existing)
├── pytest/
│   └── pytestExecutionAdapter.unit.test.ts (extend)
├── debugLauncher.unit.test.ts              (extend in common/)
└── controller.unit.test.ts                  (extend)
```

### 2. Shared Test Utilities

Create a helper file for project-based test utilities:

```typescript
// src/test/testing/testController/common/projectTestHelpers.ts

import { TestItem, Uri } from 'vscode';
import { ProjectAdapter } from '../../../../client/testing/testController/common/projectAdapter';

export function createMockTestItem(id: string, uriPath: string, children?: TestItem[]): TestItem {
    const childMap = new Map<string, TestItem>();
    children?.forEach(c => childMap.set(c.id, c));

    return {
        id,
        uri: Uri.file(uriPath),
        children: {
            size: childMap.size,
            forEach: (cb: (item: TestItem) => void) => childMap.forEach(cb)
        }
    } as unknown as TestItem;
}

export function createMockProjectAdapter(config: {
    projectPath: string;
    projectName: string;
    pythonPath?: string;
    testProvider?: 'pytest' | 'unittest';
}): ProjectAdapter {
    return {
        projectUri: Uri.file(config.projectPath),
        projectName: config.projectName,
        testProvider: config.testProvider ?? 'pytest',
        pythonEnvironment: config.pythonPath ? {
            execInfo: { run: { executable: config.pythonPath } }
        } : undefined,
        executionAdapter: {
            runTests: sinon.stub().resolves()
        },
        resultResolver: {
            vsIdToRunId: new Map(),
            detailedCoverageMap: new Map()
        }
    } as unknown as ProjectAdapter;
}

export function createMockDependencies(): ProjectExecutionDependencies {
    return {
        projectRegistry: typemoq.Mock.ofType<TestProjectRegistry>().object,
        pythonExecFactory: typemoq.Mock.ofType<IPythonExecutionFactory>().object,
        debugLauncher: typemoq.Mock.ofType<ITestDebugLauncher>().object
    };
}
```

### 3. Test Priority Order

1. **HIGH PRIORITY** - Core logic tests:
   - `groupTestItemsByProject()` - All cases
   - `findProjectForTestItem()` - All cases
   - `executeTestsForProject()` - Basic flow
   - Debug session isolation tests

2. **MEDIUM PRIORITY** - Integration tests:
   - Multi-project execution flow
   - Cancellation propagation
   - Error handling

3. **LOWER PRIORITY** - Edge cases:
   - Windows path handling
   - Coverage setup
   - Telemetry verification

### 4. Mocking Strategy

| Component | Mock Type | Reason |
|-----------|-----------|--------|
| `TestItem` | Custom object | Simple interface |
| `ProjectAdapter` | Custom object | Many optional fields |
| `TestRun` | TypeMoq | Verify method calls |
| `IPythonExecutionFactory` | TypeMoq | Interface with promises |
| `ITestDebugLauncher` | TypeMoq | Interface with callbacks |
| `IDebugService` | TypeMoq | Complex async behavior |
| Utility functions (`util.*`) | Sinon stub | Replace implementation |

### 5. Async Testing Patterns

```typescript
// Pattern for testing cancellation
test('should stop on cancellation', async () => {
    const token = new CancellationTokenSource();
    const deferredExecution = createDeferred<void>();

    mockAdapter.runTests.callsFake(async () => {
        token.cancel(); // Cancel during execution
        await deferredExecution.promise;
    });

    // Should complete without hanging
    await executeTestsForProjects(projects, items, runInstance, request, token.token, deps);

    // Verify correct behavior
    expect(log).to.include('cancelled');
});

// Pattern for parallel execution verification
test('should execute projects in parallel', async () => {
    const executionOrder: string[] = [];
    const deferreds = projects.map(() => createDeferred<void>());

    projects.forEach((p, i) => {
        p.executionAdapter.runTests.callsFake(async () => {
            executionOrder.push(`start-${i}`);
            await deferreds[i].promise;
            executionOrder.push(`end-${i}`);
        });
    });

    const executePromise = executeTestsForProjects(...);

    // All should have started before any completed
    await new Promise(r => setTimeout(r, 10));
    expect(executionOrder).to.deep.equal(['start-0', 'start-1', 'start-2']);

    // Resolve all
    deferreds.forEach(d => d.resolve());
    await executePromise;
});
```

---

## Summary

| Test Category | Estimated Test Count | Effort |
|---------------|---------------------|--------|
| `projectTestExecution.unit.test.ts` (new) | ~25 tests | Medium |
| `pytestExecutionAdapter.unit.test.ts` (extend) | ~5 tests | Low |
| `debugLauncher.unit.test.ts` (extend) | ~8 tests | Medium |
| `controller.unit.test.ts` (extend) | ~3 tests | Low |
| Integration tests (optional) | ~10 tests | High |
| **Total** | **~50 tests** | - |

The primary focus should be on the new `projectTestExecution.unit.test.ts` file, as it contains all the new orchestration logic. The debug launcher session isolation tests are also critical since they fix a real bug.
