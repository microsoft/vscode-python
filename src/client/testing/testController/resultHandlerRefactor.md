# Result Resolver Refactoring Specification

## Overview

Refactor `PythonResultResolver` to separate stateful concerns (ID mappings) from stateless processing logic (payload handling). This improves testability, clarity, and sets the foundation for future project-based architecture.

## Current Problems

The `PythonResultResolver` class conflates multiple responsibilities:
1. **Persistent state**: ID mappings between Python test IDs and VS Code TestItem IDs
2. **Discovery processing**: Building TestItem trees from JSON payloads
3. **Execution processing**: Updating TestRun instances from execution results
4. **Coverage processing**: Handling coverage data
5. **Error handling**: Creating error nodes

This mixing of state and processing makes it:
- Hard to reason about lifecycle and ownership
- Difficult to test in isolation
- Unclear what state persists vs. what is transient
- Prone to state conflicts if multiple operations run concurrently

## New Design: Separation of Concerns

### Ownership Model Summary

**Singleton (One per Extension):**
- `TestDiscoveryHandler` - stateless, shared by all workspaces
- `TestExecutionHandler` - stateless, shared by all workspaces
- `TestCoverageHandler` - stateless, shared by all workspaces

**Per-Workspace:**
- `PythonResultResolver` - facade that coordinates components
- `TestItemIndex` - stateful, stores ID mappings for this workspace's tests

**Shared References:**
- `TestController` - one per extension, passed to handlers as parameter
- `TestRun` - one per execution request, passed to handlers as parameter

**Why This Works:**
- Handlers are pure functions with no instance state → safe to share
- All state is passed as parameters or stored in caller (resolver/index)
- Each workspace gets its own index, but all use the same handler logic

### State Lifecycle: Where Test ID Mappings Live

The `TestItemIndex` is **the only stateful component** in the new design. Here's its complete lifecycle:

#### 1. Creation (Workspace Activation)
```typescript
// In PythonTestController.activate()
const resultResolver = new PythonResultResolver(
    this.testController,
    testProvider,
    workspace.uri
);

// Inside PythonResultResolver constructor
constructor(testController, testProvider, workspaceUri) {
    this.testItemIndex = new TestItemIndex();  // ← CREATED HERE
    // Initially empty: no test IDs registered yet
}
```

#### 2. Population (Discovery Phase)
```typescript
// Discovery flow:
Python subprocess → DiscoveryAdapter → PythonResultResolver.resolveDiscovery()
                                    → TestDiscoveryHandler.processDiscovery()

// Inside TestDiscoveryHandler.processDiscovery()
testItemIndex.clear();  // Wipe old mappings

for each discovered test {
    // Create VS Code TestItem
    const testItem = testController.createTestItem(test.id_, test.name, uri);

    // Register in index (WRITES STATE)
    testItemIndex.registerTestItem(
        runId: test.runID,        // e.g., "test_file.py::test_example"
        vsId: test.id_,           // e.g., "test_file.py::test_example"
        testItem: testItem        // Reference to VS Code TestItem object
    );
}

// Now index contains:
// runIdToTestItem: { "test_file.py::test_example" → TestItem }
// runIdToVSid: { "test_file.py::test_example" → "test_file.py::test_example" }
// vsIdToRunId: { "test_file.py::test_example" → "test_file.py::test_example" }
```

#### 3. Query (Execution Preparation)
```typescript
// In WorkspaceTestAdapter.executeTests()
// User selected some tests to run, need to convert VS Code IDs → Python IDs

testCaseNodes.forEach((node) => {
    // READS STATE from index (via resolver getter)
    const runId = resultResolver.vsIdToRunId.get(node.id);
    // ↑ This delegates to: testItemIndex.getRunId(node.id)

    if (runId) {
        testCaseIds.push(runId);  // Send to Python subprocess
    }
});
```

#### 4. Lookup (Execution Results Processing)
```typescript
// Execution flow:
Python subprocess → ExecutionAdapter → PythonResultResolver.resolveExecution()
                                    → TestExecutionHandler.processExecution()

// Inside TestExecutionHandler.processExecution()
for each test result in payload {
    const runId = "test_file.py::test_example";  // From Python

    // READS STATE from index
    const testItem = testItemIndex.getTestItem(runId, testController);
    // ↑ Looks up: runIdToTestItem.get("test_file.py::test_example") → TestItem

    if (testItem) {
        runInstance.passed(testItem);  // Update VS Code UI
    }
}
```

#### 5. Cleanup (Periodic or On Demand)
```typescript
// When tests are deleted/modified without full rediscovery
resultResolver.cleanupStaleReferences();
// ↓ Delegates to:
testItemIndex.cleanupStaleReferences(testController);

// Removes mappings for TestItems that no longer exist in the tree
```

#### 6. Disposal (Workspace Closed)
```typescript
// When workspace is removed or extension deactivates
// PythonResultResolver gets garbage collected
// → testItemIndex gets garbage collected
// → Maps are freed
```

### Key Insight: Index is the "Glue"

```
┌─────────────────────────────────────────────────────────────┐
│                    DISCOVERY PHASE                          │
├─────────────────────────────────────────────────────────────┤
│ Python: "test_file.py::test_example"                        │
│    ↓                                                         │
│ TestDiscoveryHandler: Creates TestItem                      │
│    ↓                                                         │
│ TestItemIndex: Stores mapping                               │
│    runId "test_file.py::test_example" → TestItem instance   │
└─────────────────────────────────────────────────────────────┘
                           ↓
                    (Index persists)
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    EXECUTION PHASE                          │
├─────────────────────────────────────────────────────────────┤
│ Python: "test_file.py::test_example" succeeded             │
│    ↓                                                         │
│ TestExecutionHandler: Needs TestItem to update              │
│    ↓                                                         │
│ TestItemIndex: Retrieves mapping                            │
│    runId "test_file.py::test_example" → TestItem instance   │
│    ↓                                                         │
│ runInstance.passed(testItem) → UI updates ✓                │
└─────────────────────────────────────────────────────────────┘
```

The index is **persistent state** that bridges discovery and execution, while handlers are **stateless processors** that operate on that state.

### Component 1: `TestItemIndex` (Stateful - Per Workspace/Adapter)

**Purpose**: Maintains persistent ID mappings between Python test IDs and VS Code TestItems.

**Ownership**: **One instance per workspace**. Created by `PythonResultResolver` constructor.

**Lifecycle**:
- **Created**: When `PythonResultResolver` is instantiated (during workspace activation)
- **Populated**: During discovery - each discovered test registers its mappings
- **Queried**: During execution - to look up TestItems by Python run ID
- **Cleared**: When discovery runs again (fresh start) or workspace is disposed
- **Cleaned**: Periodically to remove stale references to deleted tests

**State Management**:
```typescript
// Discovery phase - WRITES to index
TestDiscoveryHandler.processDiscovery() {
    testItemIndex.clear();  // Start fresh
    for each discovered test:
        testItemIndex.registerTestItem(test.runID, test.id_, testItem);
}

// Execution phase - READS from index
TestExecutionHandler.processExecution() {
    for each test result:
        testItem = testItemIndex.getTestItem(runId);  // Lookup!
        runInstance.passed/failed/errored(testItem);
}
```

**Responsibilities**:
- Store bidirectional mappings: `runId ↔ TestItem`, `runId ↔ vsId`
- Provide efficient lookup methods
- Clean up stale references when tests are removed
- Validate TestItem references are still in the tree

**Location**: `src/client/testing/testController/common/testItemIndex.ts`

**Interface**:
```typescript
export class TestItemIndex {
    // THE STATE - these maps persist across discovery and execution
    private runIdToTestItem: Map<string, TestItem>;
    private runIdToVSid: Map<string, string>;
    private vsIdToRunId: Map<string, string>;

    constructor();

    /**
     * Register a test item with its Python run ID and VS Code ID
     * Called during DISCOVERY to populate the index
     */
    registerTestItem(runId: string, vsId: string, testItem: TestItem): void;

    /**
     * Get TestItem by Python run ID (with validation and fallback strategies)
     * Called during EXECUTION to look up tests
     */
    getTestItem(runId: string, testController: TestController): TestItem | undefined;

    /**
     * Get Python run ID from VS Code ID
     * Called by WorkspaceTestAdapter.executeTests() to convert selected tests to Python IDs
     */
    getRunId(vsId: string): string | undefined;

    /**
     * Get VS Code ID from Python run ID
     */
    getVSId(runId: string): string | undefined;

    /**
     * Check if a TestItem reference is still valid in the tree
     */
    isTestItemValid(testItem: TestItem, testController: TestController): boolean;

    /**
     * Remove all mappings
     * Called at the start of discovery to ensure clean state
     */
    clear(): void;

    /**
     * Clean up stale references that no longer exist in the test tree
     * Called after test tree modifications
     */
    cleanupStaleReferences(testController: TestController): void;
}
```

### Component 2: `TestDiscoveryHandler` (Stateless - Shared)

**Purpose**: Processes discovery payloads and builds/updates the TestItem tree.

**Ownership**: **One shared instance** created at the module/service level, reused by all resolvers/adapters.

**Responsibilities**:
- Parse `DiscoveredTestPayload` and create/update TestItems
- Call `TestItemIndex.registerTestItem()` for each discovered test
- Handle discovery errors and create error nodes
- Populate test tree structure

**Location**: `src/client/testing/testController/common/testDiscoveryHandler.ts`

**Interface**:
```typescript
export class TestDiscoveryHandler {
    /**
     * Process discovery payload and update test tree
     * Pure function - no instance state used
     */
    processDiscovery(
        payload: DiscoveredTestPayload,
        testController: TestController,
        testItemIndex: TestItemIndex,
        workspaceUri: Uri,
        testProvider: TestProvider,
        token?: CancellationToken
    ): void;

    /**
     * Create an error node for discovery failures
     */
    createErrorNode(
        testController: TestController,
        workspaceUri: Uri,
        message: string,
        testProvider: TestProvider
    ): TestItem;
}
```

### Component 3: `TestExecutionHandler` (Stateless - Shared)

**Purpose**: Processes execution payloads and updates TestRun instances.

**Ownership**: **One shared instance** created at the module/service level, reused by all resolvers/adapters.

**Responsibilities**:
- Parse `ExecutionTestPayload` and update TestRun with results (passed/failed/skipped/errored)
- Look up TestItems using `TestItemIndex`
- Handle subtests (create child TestItems dynamically)
- Process test outcomes and create TestMessages

**Location**: `src/client/testing/testController/common/testExecutionHandler.ts`

**Interface**:
```typescript
export class TestExecutionHandler {
    /**
     * Process execution payload and update test run
     * Pure function - no instance state used
     * Returns subtest statistics for caller to manage
     */
    processExecution(
        payload: ExecutionTestPayload,
        runInstance: TestRun,
        testItemIndex: TestItemIndex,
        testController: TestController
    ): Map<string, SubtestStats>;

    /**
     * Handle a single test result based on outcome
     */
    private handleTestOutcome(
        runId: string,
        testItem: any,
        runInstance: TestRun,
        testItemIndex: TestItemIndex,
        testController: TestController,
        subtestStats: Map<string, SubtestStats>
    ): void;
}

export interface SubtestStats {
    passed: number;
    failed: number;
}
```

### Component 4: `TestCoverageHandler` (Stateless - Shared)

**Purpose**: Processes coverage payloads and creates coverage objects.

**Ownership**: **One shared instance** created at the module/service level, reused by all resolvers/adapters.

**Responsibilities**:
- Parse `CoveragePayload` and create `FileCoverage` objects
- Generate detailed coverage information
- Return coverage data for caller to store/use

**Location**: `src/client/testing/testController/common/testCoverageHandler.ts`

**Interface**:
```typescript
export class TestCoverageHandler {
    /**
     * Process coverage payload
     * Pure function - returns coverage data without storing it
     */
    processCoverage(
        payload: CoveragePayload,
        runInstance: TestRun
    ): Map<string, FileCoverageDetail[]>;

    /**
     * Create FileCoverage object from metrics
     */
    private createFileCoverage(
        uri: Uri,
        metrics: FileCoverageMetrics
    ): FileCoverage;

    /**
     * Create detailed coverage array for a file
     */
    private createDetailedCoverage(
        linesCovered: number[],
        linesMissed: number[]
    ): FileCoverageDetail[];
}
```

### Component 5: `PythonResultResolver` (Adapter/Facade - Maintained for Compatibility)

**Purpose**: Maintains backward compatibility during transition. Delegates to new components.

**Ownership**: **One instance per workspace** (current model). References shared handler instances.

**Responsibilities**:
- Wrap new components to maintain existing API
- Eventually can be deprecated once all callers migrate

**Location**: `src/client/testing/testController/common/resultResolver.ts` (modified)

**Interface**:
```typescript
export class PythonResultResolver implements ITestResultResolver {
    private testItemIndex: TestItemIndex;  // Per-workspace instance
    private testController: TestController;  // Shared reference
    private testProvider: TestProvider;  // Configuration
    private workspaceUri: Uri;  // Configuration

    // References to shared singleton handlers
    private static discoveryHandler: TestDiscoveryHandler = new TestDiscoveryHandler();
    private static executionHandler: TestExecutionHandler = new TestExecutionHandler();
    private static coverageHandler: TestCoverageHandler = new TestCoverageHandler();

    // Expose for backward compatibility (WorkspaceTestAdapter accesses these)
    public get runIdToTestItem(): Map<string, TestItem> {
        return this.testItemIndex.runIdToTestItem;
    }
    public get runIdToVSid(): Map<string, string> {
        return this.testItemIndex.runIdToVSid;
    }
    public get vsIdToRunId(): Map<string, string> {
        return this.testItemIndex.vsIdToRunId;
    }
    public subTestStats: Map<string, SubtestStats>;
    public detailedCoverageMap: Map<string, FileCoverageDetail[]>;

    constructor(
        testController: TestController,
        testProvider: TestProvider,
        workspaceUri: Uri
    ) {
        this.testController = testController;
        this.testProvider = testProvider;
        this.workspaceUri = workspaceUri;
        this.testItemIndex = new TestItemIndex();  // Per-workspace state
        this.subTestStats = new Map();
        this.detailedCoverageMap = new Map();
    }

    public resolveDiscovery(payload: DiscoveredTestPayload, token?: CancellationToken): void {
        PythonResultResolver.discoveryHandler.processDiscovery(
            payload,
            this.testController,
            this.testItemIndex,
            this.workspaceUri,
            this.testProvider,
            token
        );
    }

    public resolveExecution(payload: ExecutionTestPayload | CoveragePayload, runInstance: TestRun): void {
        if ('coverage' in payload) {
            const coverageMap = PythonResultResolver.coverageHandler.processCoverage(payload, runInstance);
            this.detailedCoverageMap = coverageMap;
        } else {
            this.subTestStats = PythonResultResolver.executionHandler.processExecution(
                payload,
                runInstance,
                this.testItemIndex,
                this.testController
            );
        }
    }

    // Delegate cleanup to index
    public cleanupStaleReferences(): void {
        this.testItemIndex.cleanupStaleReferences(this.testController);
    }
}
```

## Migration Strategy

### Phase 1: Extract `TestItemIndex`
**Goal**: Separate ID mapping state from processing logic

**Steps**:
1. Create `src/client/testing/testController/common/testItemIndex.ts`
2. Move mapping-related methods from `PythonResultResolver`:
   - `runIdToTestItem`, `runIdToVSid`, `vsIdToRunId` maps
   - `findTestItemByIdEfficient()`
   - `isTestItemValid()`
   - `cleanupStaleReferences()`
3. Update `PythonResultResolver` to use `TestItemIndex` internally
4. Maintain backward compatibility with existing API
5. Add unit tests for `TestItemIndex`

**Files Changed**:
- New: `testItemIndex.ts`
- Modified: `resultResolver.ts`

**Tests**:
- Test ID registration and lookup
- Test stale reference cleanup
- Test validation logic

### Phase 2: Extract `TestDiscoveryHandler`
**Goal**: Separate discovery processing into stateless handler

**Steps**:
1. Create `src/client/testing/testController/common/testDiscoveryHandler.ts`
2. Move discovery-related methods from `PythonResultResolver`:
   - `_resolveDiscovery()`
   - Error node creation logic
   - Test tree population logic (from `utils.ts`)
3. Update `PythonResultResolver.resolveDiscovery()` to delegate to handler
4. Add unit tests for `TestDiscoveryHandler`

**Files Changed**:
- New: `testDiscoveryHandler.ts`
- Modified: `resultResolver.ts`
- Modified: `utils.ts` (move `populateTestTree` to handler)

**Tests**:
- Test discovery payload processing
- Test error handling
- Test TestItem creation and tree building

### Phase 3: Extract `TestExecutionHandler`
**Goal**: Separate execution processing into stateless handler

**Steps**:
1. Create `src/client/testing/testController/common/testExecutionHandler.ts`
2. Move execution-related methods from `PythonResultResolver`:
   - `_resolveExecution()`
   - `handleTestError()`, `handleTestFailure()`, `handleTestSuccess()`, `handleTestSkipped()`
   - `handleSubtestFailure()`, `handleSubtestSuccess()`
3. Update handler to return subtest stats instead of storing them
4. Update `PythonResultResolver.resolveExecution()` to delegate to handler
5. Add unit tests for `TestExecutionHandler`

**Files Changed**:
- New: `testExecutionHandler.ts`
- Modified: `resultResolver.ts`

**Tests**:
- Test each outcome type (error, failure, success, skipped)
- Test subtest handling
- Test message creation with tracebacks

### Phase 4: Extract `TestCoverageHandler`
**Goal**: Separate coverage processing into stateless handler

**Steps**:
1. Create `src/client/testing/testController/common/testCoverageHandler.ts`
2. Move coverage-related methods from `PythonResultResolver`:
   - `_resolveCoverage()`
   - Coverage object creation logic
3. Update handler to return coverage data instead of storing it
4. Update `PythonResultResolver.resolveExecution()` to delegate to handler and store results
5. Add unit tests for `TestCoverageHandler`

**Files Changed**:
- New: `testCoverageHandler.ts`
- Modified: `resultResolver.ts`

**Tests**:
- Test coverage payload processing
- Test FileCoverage creation
- Test detailed coverage generation

### Phase 5: Update `PythonResultResolver` to Pure Facade
**Goal**: Simplify resolver to only coordinate components

**Steps**:
1. Remove all processing logic from `PythonResultResolver`
2. Keep only delegation and backward compatibility methods
3. Update constructor to instantiate handler components
4. Ensure all existing tests still pass

**Files Changed**:
- Modified: `resultResolver.ts`

### Phase 6: Direct Migration (Optional - Future)
**Goal**: Update callers to use handlers directly instead of through resolver

**Steps**:
1. Update `WorkspaceTestAdapter` to use handlers directly
2. Update discovery/execution adapters if needed
3. Eventually deprecate `PythonResultResolver` once all callers migrated

**Files Changed**:
- Modified: `workspaceTestAdapter.ts`
- Modified: `pytestDiscoveryAdapter.ts`, `unittestDiscoveryAdapter.ts`
- Modified: `pytestExecutionAdapter.ts`, `unittestExecutionAdapter.ts`

## Benefits

### Immediate Benefits
1. **Testability**: Each component can be unit tested in isolation with simple inputs/outputs
2. **Clarity**: Clear separation between state (index) and processing (handlers)
3. **Maintainability**: Smaller, focused classes are easier to understand and modify
4. **Type Safety**: Clearer interfaces and types for each concern

### Future Benefits (Project-based Architecture)
1. **Concurrency**: Stateless handlers can be safely shared across projects
2. **Scalability**: Each project gets its own `TestItemIndex`, handlers are shared
3. **Flexibility**: Easy to add new processing logic without modifying state management
4. **Migration Path**: Clean abstractions make it easier to introduce project adapters

#####################################################

# Parts to do later ->

## Testing Strategy

### Unit Tests

**`TestItemIndex`**:
- Test registration and lookup operations
- Test stale reference detection
- Test cleanup operations
- Test edge cases (missing items, invalid references)

**`TestDiscoveryHandler`**:
- Test parsing valid discovery payloads
- Test error payload handling
- Test tree building with various structures
- Test edge cases (null tests, empty payloads)

**`TestExecutionHandler`**:
- Test each outcome type (success, failure, error, skip)
- Test subtest creation and statistics
- Test message creation with locations
- Test edge cases (missing items, invalid IDs)

**`TestCoverageHandler`**:
- Test coverage payload parsing
- Test FileCoverage creation
- Test detailed coverage generation
- Test branch coverage vs. line coverage

### Integration Tests

**End-to-end discovery flow**:
- Verify discovery adapters → handlers → TestController updates work correctly
- Verify index is populated correctly during discovery

**End-to-end execution flow**:
- Verify execution adapters → handlers → TestRun updates work correctly
- Verify index lookups work during execution

### Regression Tests

- Run full test suite to ensure no behavioral changes
- Verify all existing discovery/execution scenarios still work
- Verify coverage functionality unchanged

## Risks and Mitigations

### Risk: Breaking Changes
**Mitigation**: Maintain `PythonResultResolver` as compatibility facade during transition. All existing callers continue to work unchanged.

### Risk: Performance Regression
**Mitigation**: Handlers are pure functions with no additional overhead. Index operations remain O(1) lookups. Profile before/after to verify.

### Risk: Incomplete State Migration
**Mitigation**: Phase 1 focuses entirely on extracting index with full backward compatibility. Each phase is independently testable.

### Risk: Subtest Stats State Management
**Mitigation**: Return stats from handler rather than storing. Let caller (resolver or adapter) decide how to manage this transient state.

## Success Criteria

1. ✅ All existing tests pass without modification
2. ✅ New unit tests achieve >90% coverage for new components
3. ✅ No performance degradation in discovery/execution
4. ✅ Code is more modular and testable
5. ✅ Clear path forward for project-based architecture
6. ✅ No breaking changes to external APIs

## Information Flow

### Discovery Flow: From Python Subprocess to Test Tree

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. USER ACTION: Refresh Tests / Auto-discovery Trigger                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. PythonTestController.refreshTestData()                              │
│    - Determines which workspace(s) to refresh                          │
│    - Calls refreshSingleWorkspace(uri) or refreshAllWorkspaces()       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. PythonTestController.discoverTestsForProvider()                     │
│    - Gets WorkspaceTestAdapter for workspace                           │
│    - Calls testAdapter.discoverTests(...)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. WorkspaceTestAdapter.discoverTests()                                │
│    - Calls discoveryAdapter.discoverTests(uri, factory, token)         │
│    - Waits for discovery to complete                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. [Pytest|Unittest]DiscoveryAdapter.discoverTests()                   │
│    - Sets up named pipe for IPC                                        │
│    - Spawns Python subprocess with discovery script                    │
│    - Subprocess runs: python_files/vscode_pytest/run_pytest_script.py  │
│                    or python_files/unittestadapter/discovery.py        │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. PYTHON SUBPROCESS: Discovery Script                                 │
│    - Collects tests using pytest/unittest framework                    │
│    - Builds DiscoveredTestPayload JSON:                                │
│      {                                                                  │
│        "status": "success",                                             │
│        "cwd": "/workspace/path",                                        │
│        "tests": {                                                       │
│          "rootid": ".",                                                 │
│          "root": "/workspace/path",                                     │
│          "parents": [...],                                              │
│          "tests": [                                                     │
│            {                                                            │
│              "name": "test_example",                                    │
│              "path": "./test_file.py",                                  │
│              "type_": "test",                                           │
│              "id_": "test_file.py::test_example",                       │
│              "runID": "test_file.py::test_example",                     │
│              "lineno": 10                                               │
│            }                                                            │
│          ]                                                              │
│        }                                                                │
│      }                                                                  │
│    - Sends JSON over named pipe                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. Discovery Adapter: Receives IPC Data                                │
│    - Named pipe listener receives JSON chunks                          │
│    - Parses complete JSON into DiscoveredTestPayload                   │
│    - Calls: resultResolver.resolveDiscovery(payload, token)            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 8. PythonResultResolver.resolveDiscovery()  [FACADE]                   │
│    - Validates payload is not null                                     │
│    - Delegates to:                                                      │
│      this.discoveryHandler.processDiscovery(                           │
│        payload,                                                         │
│        this.testController,                                             │
│        this.testItemIndex,                                              │
│        this.workspaceUri,                                               │
│        this.testProvider,                                               │
│        token                                                            │
│      )                                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 9. TestDiscoveryHandler.processDiscovery()  [STATELESS]                │
│    - Checks payload.status for errors                                  │
│    - If errors: creates error node and adds to TestController          │
│    - If success: processes payload.tests                               │
│    - Calls populateTestTree() to build TestItem hierarchy              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 10. TestDiscoveryHandler: Build Test Tree                              │
│     - Clears testItemIndex mappings (fresh start)                      │
│     - Iterates through discovered tests recursively                    │
│     - For each test:                                                   │
│       a. Creates VS Code TestItem:                                     │
│          testItem = testController.createTestItem(                     │
│            id: test.id_,                                               │
│            label: test.name,                                           │
│            uri: Uri.file(test.path)                                    │
│          )                                                             │
│       b. Sets TestItem properties (range, canResolveChildren, etc.)   │
│       c. Registers in index:                                          │
│          testItemIndex.registerTestItem(                              │
│            runId: test.runID,                                         │
│            vsId: test.id_,                                            │
│            testItem: testItem                                         │
│          )                                                            │
│       d. Adds TestItem to parent or TestController.items             │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 11. TestItemIndex.registerTestItem()  [STATEFUL]                       │
│     - Stores mappings:                                                 │
│       runIdToTestItem.set(runId, testItem)                            │
│       runIdToVSid.set(runId, vsId)                                    │
│       vsIdToRunId.set(vsId, runId)                                    │
│     - These mappings persist for execution phase                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 12. VS CODE TEST EXPLORER: Tree Updated                                │
│     - TestController.items now contains full test hierarchy            │
│     - Test Explorer UI refreshes to show discovered tests              │
│     - Tests are ready to be run                                        │
└─────────────────────────────────────────────────────────────────────────┘


### Execution Flow: From Run Request to Result Updates

┌─────────────────────────────────────────────────────────────────────────┐
│ 1. USER ACTION: Run/Debug Tests                                        │
│    - User clicks run icon, uses command palette, or keyboard shortcut  │
│    - VS Code creates TestRunRequest with selected TestItems            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. PythonTestController.runTests(request, token)                       │
│    - Gets workspaces that contain selected tests                       │
│    - Creates TestRun instance from TestController                      │
│    - Calls runTestsForWorkspace() for each workspace                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. PythonTestController.runTestsForWorkspace()                         │
│    - Filters TestItems belonging to this workspace                     │
│    - Gets WorkspaceTestAdapter for workspace                           │
│    - Calls testAdapter.executeTests(...)                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. WorkspaceTestAdapter.executeTests()                                 │
│    - Collects all test case nodes from selected items                  │
│    - For each test, looks up Python runID:                             │
│      runId = resultResolver.vsIdToRunId.get(node.id)                  │
│    - Calls runInstance.started(node) for each test                    │
│    - Calls executionAdapter.runTests(uri, testCaseIds, ...)           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. [Pytest|Unittest]ExecutionAdapter.runTests()                        │
│    - Sets up named pipe for IPC                                        │
│    - Spawns Python subprocess with execution script                    │
│    - Subprocess runs: python_files/vscode_pytest/run_pytest_script.py  │
│                    or python_files/unittestadapter/execution.py        │
│    - Passes test IDs as arguments                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. PYTHON SUBPROCESS: Execution Script                                 │
│    - Runs selected tests using pytest/unittest framework               │
│    - Captures results in real-time                                     │
│    - For each test result, builds ExecutionTestPayload:                │
│      {                                                                  │
│        "result": {                                                      │
│          "test_file.py::test_example": {                                │
│            "test": "test_file.py::test_example",                        │
│            "outcome": "success",  // or "failure", "error", "skipped"  │
│            "message": "...",                                            │
│            "traceback": "...",                                          │
│            "subtest": null                                              │
│          }                                                              │
│        }                                                                │
│      }                                                                  │
│    - Sends JSON over named pipe (can send multiple payloads)           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. Execution Adapter: Receives IPC Data (Streaming)                    │
│    - Named pipe listener receives JSON chunks as tests complete        │
│    - For each complete JSON payload:                                   │
│      - Parses into ExecutionTestPayload or CoveragePayload             │
│      - Calls: resultResolver.resolveExecution(payload, runInstance)   │
│    - Updates happen in real-time as tests finish                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 8. PythonResultResolver.resolveExecution()  [FACADE]                   │
│    - Checks payload type:                                              │
│      if ('coverage' in payload):                                       │
│        coverageMap = coverageHandler.processCoverage(payload, run)    │
│        this.detailedCoverageMap = coverageMap                         │
│      else:                                                             │
│        subtestStats = executionHandler.processExecution(              │
│          payload, runInstance, testItemIndex, testController          │
│        )                                                               │
│        this.subTestStats = subtestStats                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 9a. TestExecutionHandler.processExecution()  [STATELESS]               │
│     - Iterates through payload.result entries                          │
│     - For each test result:                                            │
│       a. Looks up TestItem using index:                                │
│          testItem = testItemIndex.getTestItem(runId, testController)  │
│       b. Routes to outcome-specific handler based on outcome:          │
│          - "success" → handleTestSuccess()                             │
│          - "failure" → handleTestFailure()                             │
│          - "error" → handleTestError()                                 │
│          - "skipped" → handleTestSkipped()                             │
│          - "subtest-success" → handleSubtestSuccess()                  │
│          - "subtest-failure" → handleSubtestFailure()                  │
│     - Returns Map of subtest statistics                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 9b. TestCoverageHandler.processCoverage()  [STATELESS]                 │
│     - Iterates through payload.result (file paths → metrics)           │
│     - For each file:                                                   │
│       a. Creates FileCoverage object with line/branch counts           │
│       b. Calls runInstance.addCoverage(fileCoverage)                  │
│       c. Builds detailed coverage array (StatementCoverage objects)   │
│     - Returns Map<filePath, FileCoverageDetail[]>                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 10. TestExecutionHandler: Update Test Results                          │
│     - handleTestSuccess(runId, runInstance):                           │
│         testItem = index.getTestItem(runId)                           │
│         runInstance.passed(testItem)                                  │
│                                                                         │
│     - handleTestFailure(runId, testData, runInstance):                │
│         testItem = index.getTestItem(runId)                           │
│         message = new TestMessage(error text + traceback)             │
│         message.location = new Location(testItem.uri, testItem.range) │
│         runInstance.failed(testItem, message)                         │
│                                                                         │
│     - handleTestError(runId, testData, runInstance):                  │
│         testItem = index.getTestItem(runId)                           │
│         message = new TestMessage(error details)                      │
│         runInstance.errored(testItem, message)                        │
│                                                                         │
│     - handleTestSkipped(runId, runInstance):                          │
│         testItem = index.getTestItem(runId)                           │
│         runInstance.skipped(testItem)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 11. TestExecutionHandler: Handle Subtests (if applicable)              │
│     - handleSubtestFailure/Success(runId, testData, runInstance):     │
│         parentTestItem = index.getTestItem(parentRunId)               │
│         subtestItem = testController.createTestItem(subtestId, ...)   │
│         parentTestItem.children.add(subtestItem)                      │
│         runInstance.started(subtestItem)                              │
│         runInstance.passed/failed(subtestItem, message)               │
│     - Updates subtest statistics map and returns to caller             │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 12. TestItemIndex: Lookup Operations  [STATEFUL]                       │
│     - getTestItem(runId, testController):                              │
│         1. Try direct lookup: runIdToTestItem.get(runId)              │
│         2. Validate item is still in tree: isTestItemValid()          │
│         3. If stale, try vsId mapping: runIdToVSid.get(runId)         │
│         4. Search tree using vsId                                     │
│         5. Fall back to full tree search if needed                    │
│     - Returns TestItem or undefined                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 13. VS CODE TEST EXPLORER: Results Updated in Real-Time                │
│     - runInstance.passed/failed/errored/skipped() calls update UI      │
│     - Test items show green checkmarks, red X's, warnings              │
│     - Error messages and tracebacks display in peek view               │
│     - Coverage decorations appear in editor (if coverage enabled)      │
│     - Duration and output appear in test results panel                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 14. Execution Complete                                                  │
│     - Python subprocess exits                                           │
│     - Execution adapter resolves promise                               │
│     - WorkspaceTestAdapter.executeTests() returns                      │
│     - PythonTestController calls runInstance.end()                     │
│     - Final telemetry sent                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Observations

**State Management**:
- `TestItemIndex` maintains persistent mappings created during discovery
- These mappings are reused during execution for efficient lookups
- Handlers are stateless - they don't store data between calls
- Transient state (subtest stats, coverage map) returned to caller for storage

**Data Flow Direction**:
- Discovery: Python → Adapter → Resolver → Handler → TestController (builds tree)
- Execution: Python → Adapter → Resolver → Handler → TestRun (updates results)
- Index: Populated during discovery, queried during execution

**Separation of Concerns**:
- Adapters: IPC and subprocess management
- Resolver: Coordination and backward compatibility
- Handlers: Pure processing logic (payload → actions)
- Index: ID mapping and lookup optimization

**Real-time Updates**:
- Execution results stream over IPC as tests complete
- Each payload is processed immediately
- UI updates happen incrementally, not in batch

## Timeline Estimate

- Phase 1 (TestItemIndex): 1-2 days
- Phase 2 (TestDiscoveryHandler): 2-3 days
- Phase 3 (TestExecutionHandler): 2-3 days
- Phase 4 (TestCoverageHandler): 1-2 days
- Phase 5 (Facade cleanup): 1 day
- Testing and refinement: 2-3 days

**Total: ~2 weeks** for complete refactor with comprehensive testing
