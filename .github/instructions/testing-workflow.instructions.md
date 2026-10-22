---
applyTo: '**/test/**'
---

# AI Testing Workflow Guide: Write, Run, and Fix Tests

This guide provides comprehensive instructions for AI agents on the complete testing workflow: writing tests, running them, diagnosing failures, and fixing issues. Use this guide whenever working with test files or when users request testing tasks.

## Complete Testing Workflow

This guide covers the full testing lifecycle:

1. **📝 Writing Tests** - Create comprehensive test suites
2. **▶️ Running Tests** - Execute tests using VS Code tools
3. **🔍 Diagnosing Issues** - Analyze failures and errors
4. **🛠️ Fixing Problems** - Resolve compilation and runtime issues
5. **✅ Validation** - Ensure coverage and resilience

### When to Use This Guide

**User Requests Testing:**

-   "Write tests for this function"
-   "Run the tests"
-   "Fix the failing tests"
-   "Test this code"
-   "Add test coverage"

**File Context Triggers:**

-   Working in `**/test/**` directories
-   Files ending in `.test.ts` or `.unit.test.ts`
-   Test failures or compilation errors
-   Coverage reports or test output analysis

## Test Types

When implementing tests as an AI agent, choose between two main types:

### Unit Tests (`*.unit.test.ts`)

-   **Fast isolated testing** - Mock all external dependencies
-   **Use for**: Pure functions, business logic, data transformations
-   **Execute with**: `runTests` tool with specific file patterns
-   **Mock everything** - VS Code APIs automatically mocked via `/src/test/unittests.ts`

### Extension Tests (`*.test.ts`)

-   **Full VS Code integration** - Real environment with actual APIs
-   **Use for**: Command registration, UI interactions, extension lifecycle
-   **Execute with**: VS Code launch configurations or `runTests` tool
-   **Slower but comprehensive** - Tests complete user workflows

## 🤖 Agent Tool Usage for Test Execution

### Primary Tool: `runTests`

Use the `runTests` tool to execute tests programmatically rather than terminal commands for better integration and result parsing:

```typescript
// Run specific test files
await runTests({
    files: ['/absolute/path/to/test.unit.test.ts'],
    mode: 'run',
});

// Run tests with coverage
await runTests({
    files: ['/absolute/path/to/test.unit.test.ts'],
    mode: 'coverage',
    coverageFiles: ['/absolute/path/to/source.ts'],
});

// Run specific test names
await runTests({
    files: ['/absolute/path/to/test.unit.test.ts'],
    testNames: ['should handle edge case', 'should validate input'],
});
```

### Compilation Requirements

Before running tests, ensure compilation. Always start compilation with `npm run watch-tests` before test execution to ensure TypeScript files are built. Recompile after making import/export changes before running tests, as stubs won't work if they're applied to old compiled JavaScript that doesn't have the updated imports:

```typescript
// Start watch mode for auto-compilation
await run_in_terminal({
    command: 'npm run watch-tests',
    isBackground: true,
    explanation: 'Start test compilation in watch mode',
});

// Or compile manually
await run_in_terminal({
    command: 'npm run compile-tests',
    isBackground: false,
    explanation: 'Compile TypeScript test files',
});
```

### Alternative: Terminal Execution

For targeted test runs when `runTests` tool is unavailable. Note: When a targeted test run yields 0 tests, first verify the compiled JS exists under `out/test` (rootDir is `src`); absence almost always means the test file sits outside `src` or compilation hasn't run yet:

```typescript
// Run specific test suite
await run_in_terminal({
    command: 'npm run unittest -- --grep "Suite Name"',
    isBackground: false,
    explanation: 'Run targeted unit tests',
});
```

## 🔍 Diagnosing Test Failures

### Common Failure Patterns

**Compilation Errors:**

```typescript
// Missing imports
if (error.includes('Cannot find module')) {
    await addMissingImports(testFile);
}

// Type mismatches
if (error.includes("Type '" && error.includes("' is not assignable"))) {
    await fixTypeIssues(testFile);
}
```

**Runtime Errors:**

```typescript
// Mock setup issues
if (error.includes('stub') || error.includes('mock')) {
    await fixMockConfiguration(testFile);
}

// Assertion failures
if (error.includes('AssertionError')) {
    await analyzeAssertionFailure(error);
}
```

### Systematic Failure Analysis

Fix test issues iteratively - run tests, analyze failures, apply fixes, repeat until passing. When unit tests fail with VS Code API errors like `TypeError: X is not a constructor` or `Cannot read properties of undefined (reading 'Y')`, check if VS Code APIs are properly mocked in `/src/test/unittests.ts` - add missing APIs following the existing pattern.

```typescript
interface TestFailureAnalysis {
    type: 'compilation' | 'runtime' | 'assertion' | 'timeout';
    message: string;
    location: { file: string; line: number; col: number };
    suggestedFix: string;
}

function analyzeFailure(failure: TestFailure): TestFailureAnalysis {
    if (failure.message.includes('Cannot find module')) {
        return {
            type: 'compilation',
            message: failure.message,
            location: failure.location,
            suggestedFix: 'Add missing import statement',
        };
    }
    // ... other failure patterns
}
```

### Agent Decision Logic for Test Type Selection

**Choose Unit Tests (`*.unit.test.ts`) when analyzing:**

-   Functions with clear inputs/outputs and no VS Code API dependencies
-   Data transformation, parsing, or utility functions
-   Business logic that can be isolated with mocks
-   Error handling scenarios with predictable inputs

**Choose Extension Tests (`*.test.ts`) when analyzing:**

-   Functions that register VS Code commands or use `vscode.*` APIs
-   UI components, tree views, or command palette interactions
-   File system operations requiring workspace context
-   Extension lifecycle events (activation, deactivation)

**Agent Implementation Pattern:**

```typescript
function determineTestType(functionCode: string): 'unit' | 'extension' {
    if (
        functionCode.includes('vscode.') ||
        functionCode.includes('commands.register') ||
        functionCode.includes('window.') ||
        functionCode.includes('workspace.')
    ) {
        return 'extension';
    }
    return 'unit';
}
```

## 🎯 Step 1: Automated Function Analysis

As an AI agent, analyze the target function systematically:

### Code Analysis Checklist

```typescript
interface FunctionAnalysis {
    name: string;
    inputs: string[]; // Parameter types and names
    outputs: string; // Return type
    dependencies: string[]; // External modules/APIs used
    sideEffects: string[]; // Logging, file system, network calls
    errorPaths: string[]; // Exception scenarios
    testType: 'unit' | 'extension';
}
```

### Analysis Implementation

1. **Read function source** using `read_file` tool
2. **Identify imports** - look for `vscode.*`, `child_process`, `fs`, etc.
3. **Map data flow** - trace inputs through transformations to outputs
4. **Catalog dependencies** - external calls that need mocking
5. **Document side effects** - logging, file operations, state changes

### Test Setup Differences

#### Unit Test Setup (\*.unit.test.ts)

```typescript
// Mock VS Code APIs - handled automatically by unittests.ts
import * as sinon from 'sinon';
import * as workspaceApis from '../../common/workspace.apis'; // Wrapper functions

// Stub wrapper functions, not VS Code APIs directly
// Always mock wrapper functions (e.g., workspaceApis.getConfiguration()) instead of
// VS Code APIs directly to avoid stubbing issues
const mockGetConfiguration = sinon.stub(workspaceApis, 'getConfiguration');
```

#### Extension Test Setup (\*.test.ts)

```typescript
// Use real VS Code APIs
import * as vscode from 'vscode';

// Real VS Code APIs available - no mocking needed
const config = vscode.workspace.getConfiguration('python');
```

## 🎯 Step 2: Generate Test Coverage Matrix

Based on function analysis, automatically generate comprehensive test scenarios:

### Coverage Matrix Generation

```typescript
interface TestScenario {
    category: 'happy-path' | 'edge-case' | 'error-handling' | 'side-effects';
    description: string;
    inputs: Record<string, any>;
    expectedOutput?: any;
    expectedSideEffects?: string[];
    shouldThrow?: boolean;
}
```

### Automated Scenario Creation

1. **Happy Path**: Normal execution with typical inputs
2. **Edge Cases**: Boundary conditions, empty/null inputs, unusual but valid data
3. **Error Scenarios**: Invalid inputs, dependency failures, exception paths
4. **Side Effects**: Verify logging calls, file operations, state changes

### Agent Pattern for Scenario Generation

```typescript
function generateTestScenarios(analysis: FunctionAnalysis): TestScenario[] {
    const scenarios: TestScenario[] = [];

    // Generate happy path for each input combination
    scenarios.push(...generateHappyPathScenarios(analysis));

    // Generate edge cases for boundary conditions
    scenarios.push(...generateEdgeCaseScenarios(analysis));

    // Generate error scenarios for each dependency
    scenarios.push(...generateErrorScenarios(analysis));

    return scenarios;
}
```

## 🗺️ Step 3: Plan Your Test Coverage

### Create a Test Coverage Matrix

#### Main Flows

-   ✅ **Happy path scenarios** - normal expected usage
-   ✅ **Alternative paths** - different configuration combinations
-   ✅ **Integration scenarios** - multiple features working together

#### Edge Cases

-   🔸 **Boundary conditions** - empty inputs, missing data
-   🔸 **Error scenarios** - network failures, permission errors
-   🔸 **Data validation** - invalid inputs, type mismatches

#### Real-World Scenarios

-   ✅ **Fresh install** - clean slate
-   ✅ **Existing user** - migration scenarios
-   ✅ **Power user** - complex configurations
-   🔸 **Error recovery** - graceful degradation

### Example Test Plan Structure

```markdown
## Test Categories

### 1. Configuration Migration Tests

-   No legacy settings exist
-   Legacy settings already migrated
-   Fresh migration needed
-   Partial migration required
-   Migration failures

### 2. Configuration Source Tests

-   Global search paths
-   Workspace search paths
-   Settings precedence
-   Configuration errors

### 3. Path Resolution Tests

-   Absolute vs relative paths
-   Workspace folder resolution
-   Path validation and filtering

### 4. Integration Scenarios

-   Combined configurations
-   Deduplication logic
-   Error handling flows
```

## 🔧 Step 4: Set Up Your Test Infrastructure

### Test File Structure

```typescript
// 1. Imports - group logically
import assert from 'node:assert';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import * as logging from '../../../common/logging';
import * as pathUtils from '../../../common/utils/pathUtils';
import * as workspaceApis from '../../../common/workspace.apis';

// 2. Function under test
import { getAllExtraSearchPaths } from '../../../managers/common/nativePythonFinder';

// 3. Mock interfaces
interface MockWorkspaceConfig {
    get: sinon.SinonStub;
    inspect: sinon.SinonStub;
    update: sinon.SinonStub;
}
```

### Mock Setup Strategy

Create minimal mock objects with only required methods and use TypeScript type assertions (e.g., `mockApi as PythonEnvironmentApi`) to satisfy interface requirements instead of implementing all interface methods when only specific methods are needed for the test. Simplify mock setup by only mocking methods actually used in tests and use `as unknown as Type` for TypeScript compatibility.

```typescript
suite('Function Integration Tests', () => {
    // 1. Declare all mocks
    let mockGetConfiguration: sinon.SinonStub;
    let mockGetWorkspaceFolders: sinon.SinonStub;
    let mockTraceLog: sinon.SinonStub;
    let mockTraceError: sinon.SinonStub;
    let mockTraceWarn: sinon.SinonStub;

    // 2. Mock complex objects
    let pythonConfig: MockWorkspaceConfig;
    let envConfig: MockWorkspaceConfig;

    setup(() => {
        // 3. Initialize all mocks
        mockGetConfiguration = sinon.stub(workspaceApis, 'getConfiguration');
        mockGetWorkspaceFolders = sinon.stub(workspaceApis, 'getWorkspaceFolders');
        mockTraceLog = sinon.stub(logging, 'traceLog');
        mockTraceError = sinon.stub(logging, 'traceError');
        mockTraceWarn = sinon.stub(logging, 'traceWarn');

        // 4. Set up default behaviors
        mockGetWorkspaceFolders.returns(undefined);

        // 5. Create mock configuration objects
        // When fixing mock environment creation, use null to truly omit
        // properties rather than undefined
        pythonConfig = {
            get: sinon.stub(),
            inspect: sinon.stub(),
            update: sinon.stub(),
        };

        envConfig = {
            get: sinon.stub(),
            inspect: sinon.stub(),
            update: sinon.stub(),
        };
    });

    teardown(() => {
        sinon.restore(); // Always clean up!
    });
});
```

## Step 4: Write Tests Using Mock → Run → Assert Pattern

### The Three-Phase Pattern

#### Phase 1: Mock (Set up the scenario)

```typescript
test('Description of what this tests', async () => {
    // Mock → Clear description of the scenario
    pythonConfig.inspect.withArgs('venvPath').returns({ globalValue: '/path' });
    envConfig.inspect.withArgs('globalSearchPaths').returns({ globalValue: [] });
    mockGetWorkspaceFolders.returns([{ uri: Uri.file('/workspace') }]);
```

#### Phase 2: Run (Execute the function)

```typescript
// Run
const result = await getAllExtraSearchPaths();
```

#### Phase 3: Assert (Verify the behavior)

```typescript
    // Assert - Use set-based comparison for order-agnostic testing
    const expected = new Set(['/expected', '/paths']);
    const actual = new Set(result);
    assert.strictEqual(actual.size, expected.size, 'Should have correct number of paths');
    assert.deepStrictEqual(actual, expected, 'Should contain exactly the expected paths');

    // Verify side effects
    // Use sinon.match() patterns for resilient assertions that don't break on minor output changes
    assert(mockTraceLog.calledWith(sinon.match(/completion/i)), 'Should log completion');
});
```

## Step 6: Make Tests Resilient

### Use Order-Agnostic Comparisons

```typescript
// ❌ Brittle - depends on order
assert.deepStrictEqual(result, ['/path1', '/path2', '/path3']);

// ✅ Resilient - order doesn't matter
const expected = new Set(['/path1', '/path2', '/path3']);
const actual = new Set(result);
assert.strictEqual(actual.size, expected.size, 'Should have correct number of paths');
assert.deepStrictEqual(actual, expected, 'Should contain exactly the expected paths');
```

### Use Flexible Error Message Testing

```typescript
// ❌ Brittle - exact text matching
assert(mockTraceError.calledWith('Error during legacy python settings migration:'));

// ✅ Resilient - pattern matching
assert(mockTraceError.calledWith(sinon.match.string, sinon.match.instanceOf(Error)), 'Should log migration error');

// ✅ Resilient - key terms with regex
assert(mockTraceError.calledWith(sinon.match(/migration.*error/i)), 'Should log migration error');
```

### Handle Complex Mock Scenarios

```typescript
// For functions that call the same mock multiple times
envConfig.inspect.withArgs('globalSearchPaths').returns({ globalValue: [] });
envConfig.inspect
    .withArgs('globalSearchPaths')
    .onSecondCall()
    .returns({
        globalValue: ['/migrated/paths'],
    });

// Testing async functions with child processes:
// Call the function first to get a promise, then use setTimeout to emit mock events,
// then await the promise - this ensures proper timing of mock setup versus function execution

// Cannot stub internal function calls within the same module after import - stub external
// dependencies instead (e.g., stub childProcessApis.spawnProcess rather than trying to stub
// helpers.isUvInstalled when testing helpers.shouldUseUv) because intra-module calls use
// direct references, not module exports
```

## 🧪 Step 7: Test Categories and Patterns

### Configuration Tests

-   Test different setting combinations
-   Test setting precedence (workspace > user > default)
-   Test configuration errors and recovery
-   Always use dynamic path construction with Node.js `path` module when testing functions that resolve paths against workspace folders to ensure cross-platform compatibility

### Data Flow Tests

-   Test how data moves through the system
-   Test transformations (path resolution, filtering)
-   Test state changes (migrations, updates)

### Error Handling Tests

-   Test graceful degradation
-   Test error logging
-   Test fallback behaviors

### Integration Tests

-   Test multiple features together
-   Test real-world scenarios
-   Test edge case combinations

## 📊 Step 8: Review and Refine

### Test Quality Checklist

-   [ ] **Clear naming** - test names describe the scenario and expected outcome
-   [ ] **Good coverage** - main flows, edge cases, error scenarios
-   [ ] **Resilient assertions** - won't break due to minor changes
-   [ ] **Readable structure** - follows Mock → Run → Assert pattern
-   [ ] **Isolated tests** - each test is independent
-   [ ] **Fast execution** - tests run quickly with proper mocking

### Common Anti-Patterns to Avoid

-   ❌ Testing implementation details instead of behavior
-   ❌ Brittle assertions that break on cosmetic changes
-   ❌ Order-dependent tests that fail due to processing changes
-   ❌ Tests that don't clean up mocks properly
-   ❌ Overly complex test setup that's hard to understand

## 🔄 Reviewing and Improving Existing Tests

### Quick Review Process

1. **Read test files** - Check structure and mock setup
2. **Run tests** - Establish baseline functionality
3. **Apply improvements** - Use patterns below. When reviewing existing tests, focus on behavior rather than implementation details in test names and assertions
4. **Verify** - Ensure tests still pass

### Common Fixes

-   Over-complex mocks → Minimal mocks with only needed methods
-   Brittle assertions → Behavior-focused with error messages
-   Vague test names → Clear scenario descriptions (transform "should return X when Y" into "should [expected behavior] when [scenario context]")
-   Missing structure → Mock → Run → Assert pattern
-   Untestable Node.js APIs → Create proxy abstraction functions (use function overloads to preserve intelligent typing while making functions mockable)

## 🧠 Agent Learnings

-   When mocking `testController.createTestItem()` in unit tests, use `typemoq.It.isAny()` for parameters when testing handler behavior (not ID/label generation logic), but consider using specific matchers (e.g., `It.is((id: string) => id.startsWith('_error_'))`) when the actual values being passed are important for correctness - this balances test precision with maintainability (2)
-   Remove unused variables from test code immediately - leftover tracking variables like `validationCallCount` that aren't referenced indicate dead code that should be simplified (1)
-   Use `Uri.file(path).fsPath` for both sides of path comparisons in tests to ensure cross-platform compatibility - Windows converts forward slashes to backslashes automatically (1)
-   When tests fail with "Cannot stub non-existent property", the method likely moved to a different class during refactoring - find the class that owns the method and test that class directly instead of stubbing on the original class (1)
