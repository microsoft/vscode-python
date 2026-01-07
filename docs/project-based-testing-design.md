# Project-Based Testing Architecture Design

## Overview

This document describes the architecture for supporting multiple Python projects within a single VS Code workspace, where each project has its own Python executable and test configuration.

**Key Concepts:**
- **Project**: A combination of a Python executable + URI (folder/file)
- **Workspace**: Contains one or more projects
- **Test Ownership**: Determined by PythonProject API, not discovery results
- **ID Scoping**: All test IDs are project-scoped to prevent collisions

---

## Architecture Diagram

```
VS Code Workspace
  └─ PythonTestController (singleton)
      ├─ TestController (VS Code API, shared)
      ├─ workspaceProjects: Map<Uri, Map<projectId, ProjectAdapter>>
      ├─ vsIdToProject: Map<vsId, ProjectAdapter> (persistent)
      └─ Workspace1
          ├─ ProjectA
          │   ├─ pythonExecutable: /workspace1/backend/.venv/bin/python
          │   ├─ projectUri: /workspace1/backend
          │   ├─ discoveryAdapter
          │   ├─ executionAdapter
          │   └─ resultResolver
          │       ├─ runIdToVSid: Map<runId, vsId>
          │       ├─ vsIdToRunId: Map<vsId, runId>
          │       └─ runIdToTestItem: Map<runId, TestItem>
          └─ ProjectB
              ├─ pythonExecutable: /workspace1/frontend/.venv/bin/python
              └─ ... (same structure)
```

---

## Core Objects

### 1. PythonTestController (Extension Singleton)

```typescript
class PythonTestController {
    // VS Code shared test controller
    testController: TestController

    // === PERSISTENT STATE ===
    // Workspace → Projects
    workspaceProjects: Map<Uri, Map<projectId, ProjectAdapter>>

    // Fast lookups for execution
    vsIdToProject: Map<vsId, ProjectAdapter>
    fileUriToProject: Map<filePath, ProjectAdapter>
    projectToVsIds: Map<projectId, Set<vsId>>

    // === TEMPORARY STATE (DISCOVERY ONLY) ===
    workspaceDiscoveryState: Map<Uri, WorkspaceDiscoveryState>

    // === METHODS ===
    activate()
    refreshTestData(uri)
    runTests(request, token)
    discoverWorkspaceProjects(workspaceUri)
}
```

### 2. ProjectAdapter (Per Project)

```typescript
interface ProjectAdapter {
    // === IDENTITY ===
    projectId: string                    // Hash of PythonProject object
    projectName: string                  // Display name
    projectUri: Uri                      // Project root folder/file
    workspaceUri: Uri                    // Parent workspace

    // === API OBJECTS (from vscode-python-environments extension) ===
    pythonProject: PythonProject         // From pythonEnvApi.projects.getProjects()
    pythonEnvironment: PythonEnvironment // From pythonEnvApi.resolveEnvironment()
    // Note: pythonEnvironment.execInfo contains execution details
    // pythonEnvironment.sysPrefix contains sys.prefix for the environment

    // === TEST INFRASTRUCTURE ===
    testProvider: TestProvider           // 'pytest' | 'unittest'
    discoveryAdapter: ITestDiscoveryAdapter
    executionAdapter: ITestExecutionAdapter
    resultResolver: PythonResultResolver

    // === DISCOVERY STATE ===
    rawDiscoveryData: DiscoveredTestPayload   // Before filtering (ALL discovered tests)
    ownedTests: DiscoveredTestNode            // After filtering (API-confirmed owned tests)
    // ownedTests is the filtered tree structure that will be passed to populateTestTree()
    // It's the root node containing only this project's tests after overlap resolution

    // === LIFECYCLE ===
    isDiscovering: boolean
    isExecuting: boolean
    projectRootTestItem: TestItem
}
```

### 3. PythonResultResolver (Per Project)

```typescript
class PythonResultResolver {
    projectId: string
    workspaceUri: Uri
    testProvider: TestProvider

    // === TEST ID MAPPINGS (per-test entries) ===
    runIdToTestItem: Map<runId, TestItem>
    runIdToVSid: Map<runId, vsId>
    vsIdToRunId: Map<vsId, runId>

    // === COVERAGE ===
    detailedCoverageMap: Map<filePath, FileCoverageDetail[]>

    // === METHODS ===
    resolveDiscovery(payload, token)
    resolveExecution(payload, runInstance)
    cleanupStaleReferences()
}
```

### 4. WorkspaceDiscoveryState (Temporary)

```typescript
interface WorkspaceDiscoveryState {
    workspaceUri: Uri

    // Overlap detection
    fileToProjects: Map<filePath, Set<ProjectAdapter>>

    // API resolution results (maps to actual PythonProject from API)
    fileOwnership: Map<filePath, ProjectAdapter>
    // Value is the ProjectAdapter whose pythonProject.uri matches API response
    // e.g., await pythonEnvApi.projects.getPythonProject(filePath) returns PythonProject,
    // then we find the ProjectAdapter with matching pythonProject.uri

    // Progress tracking (NEW - not in current multi-workspace design)
    projectsCompleted: Set<projectId>
    totalProjects: number
    isComplete: boolean
    // Advantage: Allows parallel discovery with proper completion tracking
    // Current design discovers workspaces sequentially; this enables:
    // 1. All projects discover in parallel
    // 2. Overlap resolution waits for ALL projects to complete
    // 3. Can show progress UI ("Discovering 3/5 projects...")
}
```

---

## ID System

### ID Types

| ID Type | Format | Scope | Purpose | Example |
|---------|--------|-------|---------|---------|
| **workspaceUri** | VS Code Uri | Global | Workspace identification | `Uri("/workspace1")` |
| **projectId** | Hash string | Unique per project | Project identification | `"project-abc123"` |
| **vsId** | `{projectId}::{path}::{testName}` | Global (unique) | VS Code TestItem.id | `"project-abc123::/ws/alice/test_alice.py::test_alice1"` |
| **runId** | Framework-specific | Per-project | Python subprocess | `"test_alice.py::test_alice1"` |

**Workspace Tracking:**
- `workspaceProjects: Map<Uri, Map<projectId, ProjectAdapter>>` - outer key is workspaceUri
- Each ProjectAdapter stores `workspaceUri` for reverse lookup
- TestItem.uri contains file path, workspace determined via `workspaceService.getWorkspaceFolder(uri)`

### ID Conversion Flow

```
Discovery:  runId (from Python) → create vsId → store in maps → create TestItem
Execution:  TestItem.id (vsId) → lookup vsId → get runId → pass to Python
```

---

## State Management

### Per-Workspace State

```typescript
// Created during workspace activation
workspaceProjects: {
    Uri("/workspace1"): {
        "project-abc123": ProjectAdapter {...},
        "project-def456": ProjectAdapter {...}
    }
}

// Created during discovery, cleared after
workspaceDiscoveryState: {
    Uri("/workspace1"): {
        fileToProjects: Map {...},
        fileOwnership: Map {...}
    }
}
```

### Per-Project State (Persistent)

Using example structure:
```
<Dir tests-plus-projects>       ← workspace root
  <Dir alice>                   ← ProjectA (project-alice)
    <Module test_alice.py>
      <Function test_alice1>
      <Function test_alice2>
    <Dir bob>                   ← ProjectB (project-bob, nested)
      <Module test_bob.py>
        <Function test_bob1>
```

```typescript
// ProjectA (alice)
ProjectAdapter {
    projectId: "project-alice",
    projectUri: Uri("/workspace/tests-plus-projects/alice"),
    pythonEnvironment: { execInfo: { run: { executable: "/alice/.venv/bin/python" }}},
    resultResolver: {
        runIdToVSid: {
            "test_alice.py::test_alice1": "project-alice::/workspace/alice/test_alice.py::test_alice1",
            "test_alice.py::test_alice2": "project-alice::/workspace/alice/test_alice.py::test_alice2"
        }
    }
}

// ProjectB (bob) - nested project
ProjectAdapter {
    projectId: "project-bob",
    projectUri: Uri("/workspace/tests-plus-projects/alice/bob"),
    pythonEnvironment: { execInfo: { run: { executable: "/alice/bob/.venv/bin/python" }}},
    resultResolver: {
        runIdToVSid: {
            "test_bob.py::test_bob1": "project-bob::/workspace/alice/bob/test_bob.py::test_bob1",
            "test_bob.py::test_bob2": "project-bob::/workspace/alice/bob/test_bob.py::test_bob2"
        }
    }
}
```

### Per-Test State

```typescript
// ProjectA's resolver - only alice tests
runIdToTestItem["test_alice.py::test_alice1"] → TestItem
runIdToVSid["test_alice.py::test_alice1"] → "project-alice::/workspace/alice/test_alice.py::test_alice1"
vsIdToRunId["project-alice::/workspace/alice/test_alice.py::test_alice1"] → "test_alice.py::test_alice1"

// ProjectB's resolver - only bob tests
runIdToTestItem["test_bob.py::test_bob1"] → TestItem
runIdToVSid["test_bob.py::test_bob1"] → "project-bob::/workspace/alice/bob/test_bob.py::test_bob1"
vsIdToRunId["project-bob::/workspace/alice/bob/test_bob.py::test_bob1"] → "test_bob.py::test_bob1"
```

---

## Discovery Flow

### Phase 1: Discover Projects

```typescript
async function activate() {
    for workspace in workspaceService.workspaceFolders {
        projects = await discoverWorkspaceProjects(workspace.uri)

        for project in projects {
            projectAdapter = createProjectAdapter(project)
            workspaceProjects[workspace.uri][project.id] = projectAdapter
        }
    }
}

async function discoverWorkspaceProjects(workspaceUri) {
    // Use PythonEnvironmentApi to get all projects in workspace
    pythonProjects = await pythonEnvApi.projects.getProjects(workspaceUri)

    return Promise.all(pythonProjects.map(async (pythonProject) => {
        // Resolve full environment details
        pythonEnv = await pythonEnvApi.resolveEnvironment(pythonProject.uri)

        return {
            projectId: hash(pythonProject),  // Hash the entire PythonProject object
            projectName: pythonProject.name,
            projectUri: pythonProject.uri,
            pythonProject: pythonProject,    // Store API object
            pythonEnvironment: pythonEnv,    // Store resolved environment
            workspaceUri: workspaceUri
        }
    }))
}
```

### Phase 2: Run Discovery Per Project

```typescript
async function refreshTestData(uri) {
    workspace = getWorkspaceFolder(uri)
    projects = workspaceProjects[workspace.uri].values()

    // Initialize discovery state
    discoveryState = new WorkspaceDiscoveryState()
    workspaceDiscoveryState[workspace.uri] = discoveryState

    // Run discovery for all projects in parallel
    await Promise.all(
        projects.map(p => discoverProject(p, discoveryState))
    )

    // Resolve overlaps and assign tests
    await resolveOverlapsAndAssignTests(workspace.uri)

    // Clear temporary state
    workspaceDiscoveryState.delete(workspace.uri)
    // Removes WorkspaceDiscoveryState for this workspace, which includes:
    // - fileToProjects map (no longer needed after ownership determined)
    // - fileOwnership map (results already used to filter ownedTests)
    // - projectsCompleted tracking (discovery finished)
    // This reduces memory footprint; persistent mappings (vsIdToProject, etc.) remain
}
```

### Phase 3: Detect Overlaps

```typescript
async function discoverProject(project, discoveryState) {
    // Run Python discovery subprocess
    rawData = await project.discoveryAdapter.discoverTests(
        project.projectUri,
        executionFactory,
        token,
        project.pythonExecutable
    )

    project.rawDiscoveryData = rawData

    // Track which projects discovered which files
    for testFile in rawData.testFiles {
        if (!discoveryState.fileToProjects.has(testFile.path)) {
            discoveryState.fileToProjects[testFile.path] = new Set()
        }
        discoveryState.fileToProjects[testFile.path].add(project)
    }
}
```

### Phase 4: Resolve Ownership

**Time Complexity:** O(F × P) where F = files discovered, P = projects per workspace
**Optimized to:** O(F_overlap × API_cost) where F_overlap = overlapping files only

```typescript
async function resolveOverlapsAndAssignTests(workspaceUri) {
    discoveryState = workspaceDiscoveryState[workspaceUri]
    projects = workspaceProjects[workspaceUri].values()

    // Query API only for overlaps or nested projects
    for [filePath, projectSet] in discoveryState.fileToProjects {
        if (projectSet.size > 1) {
            // OVERLAP - query API
            apiProject = await pythonEnvApi.projects.getPythonProject(filePath)
            discoveryState.fileOwnership[filePath] = findProject(apiProject.uri)
        }
        else if (hasNestedProjectForPath(filePath, projects)) {
            // Nested project exists - verify with API
            apiProject = await pythonEnvApi.projects.getPythonProject(filePath)
            discoveryState.fileOwnership[filePath] = findProject(apiProject.uri)
        }
        else {
            // No overlap - assign to only discoverer
            discoveryState.fileOwnership[filePath] = [...projectSet][0]
        }
    }

    // Filter each project's raw data to only owned tests
    for project in projects {
        project.ownedTests = project.rawDiscoveryData.tests.filter(test =>
            discoveryState.fileOwnership[test.filePath] === project
        )

        // Create TestItems and build mappings
        await finalizeProjectDiscovery(project)
    }
}
```
// NOTE: can you add in the time complexity for this larger functions

### Phase 5: Create TestItems and Mappings

**Time Complexity:** O(T) where T = tests owned by project

```typescript
async function finalizeProjectDiscovery(project) {
    // Pass filtered data to resolver
    project.resultResolver.resolveDiscovery(project.ownedTests, token)

    // Create TestItems in TestController
    testItems = await populateTestTree(
        testController,
        project.ownedTests,
        project.projectRootTestItem,
        project.resultResolver,
        project.projectId
    )

    // Build persistent mappings
    for testItem in testItems {
        vsId = testItem.id

        // Global mappings for execution
        vsIdToProject[vsId] = project
        fileUriToProject[testItem.uri.fsPath] = project

        if (!projectToVsIds.has(project.projectId)) {
            projectToVsIds[project.projectId] = new Set()
        }
        projectToVsIds[project.projectId].add(vsId)
    }
}
```

---

## Execution Flow

### Phase 1: Group Tests by Project

**Time Complexity:** O(T) where T = tests in run request

**Note:** Similar to existing `getTestItemsForWorkspace()` in controller.ts but groups by project instead of workspace

```typescript
async function runTests(request: TestRunRequest, token) {
    testItems = request.include || getAllTestItems()

    // Group by project using persistent mapping (similar pattern to getTestItemsForWorkspace)
    testsByProject = new Map<ProjectAdapter, TestItem[]>()

    for testItem in testItems {
        vsId = testItem.id
        project = vsIdToProject[vsId]  // O(1) lookup

        if (!testsByProject.has(project)) {
            testsByProject[project] = []
        }
        testsByProject[project].push(testItem)
    }

    // Execute each project
    runInstance = testController.createTestRun(request, ...)

    await Promise.all(
        [...testsByProject].map(([project, tests]) =>
            runTestsForProject(project, tests, runInstance, token)
        )
    )

    runInstance.end()
}
```
// NOTE: there is already an existing function that does this but instead for workspaces for multiroot ones, see getTestItemsForWorkspace in controller.ts

### Phase 2: Convert vsId → runId

**Time Complexity:** O(T_project) where T_project = tests for this specific project

```typescript
async function runTestsForProject(project, testItems, runInstance, token) {
    runIds = []

    for testItem in testItems {
        vsId = testItem.id

        // Use project's resolver to get runId
        runId = project.resultResolver.vsIdToRunId[vsId]
        if (runId) {
            runIds.push(runId)
            runInstance.started(testItem)
        }
    }

    // Execute with project's Python executable
    await project.executionAdapter.runTests(
        project.projectUri,
        runIds,  // Pass to Python subprocess
        runInstance,
        executionFactory,
        token,
        project.pythonExecutable
    )
}
```

### Phase 3: Report Results

```typescript
// Python subprocess sends results back with runIds
async function handleTestResult(payload, runInstance, project) {
    // Resolver converts runId → TestItem
    testItem = project.resultResolver.runIdToTestItem[payload.testId]

    if (payload.outcome === "passed") {
        runInstance.passed(testItem)
    } else if (payload.outcome === "failed") {
        runInstance.failed(testItem, message)
    }
}
```

---

## Key Algorithms

### Overlap Detection

```typescript
function hasNestedProjectForPath(testFilePath, allProjects, excludeProject) {
    return allProjects.some(p =>
        p !== excludeProject &&
        testFilePath.startsWith(p.projectUri.fsPath)
    )
}
```

### Project Cleanup/Refresh

```typescript
async function refreshProject(project) {
    // 1. Get all vsIds for this project
    vsIds = projectToVsIds[project.projectId] || new Set()

    // 2. Remove old mappings
    for vsId in vsIds {
        vsIdToProject.delete(vsId)

        testItem = project.resultResolver.runIdToTestItem[vsId]
        if (testItem) {
            fileUriToProject.delete(testItem.uri.fsPath)
        }
    }
    projectToVsIds.delete(project.projectId)

    // 3. Clear project's resolver
    project.resultResolver.testItemIndex.clear()

    // 4. Clear TestItems from TestController
    if (project.projectRootTestItem) {
        childIds = [...project.projectRootTestItem.children].map(c => c.id)
        for id in childIds {
            project.projectRootTestItem.children.delete(id)
        }
    }

    // 5. Re-run discovery
    await discoverProject(project, ...)
    await finalizeProjectDiscovery(project)
}
```

### File Change Handling

```typescript
function onDidSaveTextDocument(doc) {
    fileUri = doc.uri.fsPath

    // Find owning project
    project = fileUriToProject[fileUri]

    if (project) {
        // Refresh only this project
        refreshProject(project)
    }
}
```

---

## Critical Design Decisions

### 1. Project-Scoped vsIds
**Decision**: Include projectId in every vsId
**Rationale**: Prevents collisions, enables fast project lookup, clear ownership

### 2. One Resolver Per Project
**Decision**: Each project has its own ResultResolver
**Rationale**: Clean isolation, no cross-project contamination, independent lifecycles

### 3. Overlap Resolution Before Mapping
**Decision**: Filter tests before resolver processes them
**Rationale**: Resolvers only see owned tests, no orphaned mappings, simpler state

### 4. Persistent Execution Mappings
**Decision**: Maintain vsIdToProject map permanently
**Rationale**: Fast execution grouping, avoid vsId parsing, support file watches

### 5. Temporary Discovery State
**Decision**: Build fileToProjects during discovery, clear after
**Rationale**: Only needed for overlap detection, reduce memory footprint

---

## Migration from Current Architecture

### Current (Workspace-Level)
```
Workspace → WorkspaceTestAdapter → ResultResolver → Tests
```

### New (Project-Level)
```
Workspace → [ProjectAdapter₁, ProjectAdapter₂, ...] → ResultResolver → Tests
                     ↓                    ↓
              pythonExec₁            pythonExec₂
```

### Backward Compatibility
- Workspaces without multiple projects: Single ProjectAdapter created automatically
- Existing tests: Assigned to default project based on workspace interpreter
- Settings: Read per-project from pythonProject.uri

---

## Open Questions / Future Considerations

1. **Project Discovery**: How often to re-scan for new projects? - don't rescan until discovery is re-triggered.
2. **Project Changes**: Handle pyproject.toml changes triggering project re-initialization - no this will be handled by the api and done later
3. **UI**: Show project name in test tree? Collapsible project nodes? - show project notes
4. **Performance**: Cache API queries for file ownership? - not right now
5. **Multi-root Workspaces**: Each workspace root as separate entity? - yes as you see it right now

---

## Summary

This architecture enables multiple Python projects per workspace by:
1. Creating a ProjectAdapter for each Python executable + URI combination
2. Running independent test discovery per project
3. Using PythonProject API to resolve overlapping test ownership
4. Maintaining project-scoped ID mappings for clean separation
5. Grouping tests by project during execution
6. Preserving current test adapter patterns at project level

**Key Principle**: Each project is an isolated testing context with its own Python environment, discovery, execution, and result tracking.

---

## Implementation Details & Decisions

### 1. TestItem Hierarchy

Following VS Code TestController API, projects are top-level items:

```typescript
// TestController.items structure
testController.items = [
    ProjectA_RootItem {
        id: "project-alice::/workspace/alice",
        label: "alice (Python 3.11)",
        children: [test files...]
    },
    ProjectB_RootItem {
        id: "project-bob::/workspace/alice/bob",
        label: "bob (Python 3.9)",
        children: [test files...]
    }
]
```

**Creation timing:** `projectRootTestItem` created during `createProjectAdapter()` in activate phase, before discovery runs.

---

### 2. Error Handling Strategy

**Principle:** Simple and transparent - show errors to users, iterate based on feedback.

| Failure Scenario | Behavior |
|------------------|----------|
| API `getPythonProject()` fails/timeout | Assign to discovering project (first in set), log warning |
| Project discovery fails | Call `traceError()` with details, show error node in test tree |
| ALL projects fail | Show error nodes for each, user sees all failures |
| API returns `undefined` | Assign to discovering project, log warning |
| No projects found | Create single default project using workspace interpreter |

```typescript
try {
    apiProject = await pythonEnvApi.projects.getPythonProject(filePath)
} catch (error) {
    traceError(`Failed to resolve ownership for ${filePath}: ${error}`)
    // Fallback: assign to first discovering project
    discoveryState.fileOwnership[filePath] = [...projectSet][0]
}
```

---

### 3. Settings & Configuration

**Decision:** Settings are per-workspace, shared by all projects in that workspace.

```typescript
// All projects in workspace1 use same settings
const settings = this.configSettings.getSettings(workspace.uri)

projectA.testProvider = settings.testing.pytestEnabled ? 'pytest' : 'unittest'
projectB.testProvider = settings.testing.pytestEnabled ? 'pytest' : 'unittest'
```

**Limitations:**
- Cannot have pytest project and unittest project in same workspace
- All projects share `pytestArgs`, `cwd`, etc.
- Future: Per-project settings via API

**pytest.ini discovery:** Each project's Python subprocess discovers its own pytest.ini when running from `project.projectUri`

---

### 4. Backwards Compatibility

**Decision:** Graceful degradation if python-environments extension not available.

```typescript
async function discoverWorkspaceProjects(workspaceUri) {
    try {
        pythonProjects = await pythonEnvApi.projects.getProjects(workspaceUri)

        if (pythonProjects.length === 0) {
            // Fallback: create single default project
            return [createDefaultProject(workspaceUri)]
        }

        return pythonProjects.map(...)
    } catch (error) {
        traceError('Python environments API not available, using single project mode')
        // Fallback: single project with workspace interpreter
        return [createDefaultProject(workspaceUri)]
    }
}

function createDefaultProject(workspaceUri) {
    const interpreter = await interpreterService.getActiveInterpreter(workspaceUri)
    return {
        projectId: hash(workspaceUri),
        projectUri: workspaceUri,
        pythonEnvironment: { execInfo: { run: { executable: interpreter.path }}},
        // ... rest matches current workspace behavior
    }
}
```

---

### 5. Project Discovery Triggers

**Decision:** Triggered on file save (inefficient but follows current pattern).

```typescript
// CURRENT BEHAVIOR: Triggers on any test file save
watchForTestContentChangeOnSave() {
    onDidSaveTextDocument(async (doc) => {
        if (matchesTestPattern(doc.uri)) {
            // NOTE: This is inefficient - re-discovers ALL projects in workspace
            // even though only one file changed. Future optimization: only refresh
            // affected project using fileUriToProject mapping
            await refreshTestData(doc.uri)
        }
    })
}

// FUTURE OPTIMIZATION (commented out for now):
// watchForTestContentChangeOnSave() {
//     onDidSaveTextDocument(async (doc) => {
//         project = fileUriToProject.get(doc.uri.fsPath)
//         if (project) {
//             await refreshProject(project)  // Only refresh one project
//         }
//     })
// }
```

**Trigger points:**
1. ✅ `activate()` - discovers all projects on startup
2. ✅ File save matching test pattern - full workspace refresh
3. ✅ Settings file change - full workspace refresh
4. ❌ `onDidChangeProjects` event - not implemented yet (future)

---

### 6. Cancellation & Timeouts

**Decision:** Single cancellation token cancels all project discoveries/executions (kill switch).

```typescript
// Discovery cancellation
async function refreshTestData(uri) {
    // One cancellation token for ALL projects in workspace
    const token = this.refreshCancellation.token

    await Promise.all(
        projects.map(p => discoverProject(p, discoveryState, token))
    )
    // If token.isCancellationRequested, ALL projects stop
}

// Execution cancellation
async function runTests(request, token) {
    // If token cancelled, ALL project executions stop
    await Promise.all(
        [...testsByProject].map(([project, tests]) =>
            runTestsForProject(project, tests, runInstance, token)
        )
    )
}
```

**No per-project timeouts** - keep simple, complexity added later if needed.

---

### 7. Path Normalization

**Decision:** Absolute paths used everywhere, no relative path handling.

```typescript
// Python subprocess returns absolute paths
rawData = {
    tests: [{
        path: "/workspace/alice/test_alice.py",  // ← absolute
        id: "test_alice.py::test_alice1"
    }]
}

// vsId constructed with absolute path
vsId = `${projectId}::/workspace/alice/test_alice.py::test_alice1`

// TestItem.uri is absolute
testItem.uri = Uri.file("/workspace/alice/test_alice.py")
```

**Path conversion responsibility:** Python adapters (pytest/unittest) ensure paths are absolute before returning to controller.

---

### 8. Resolver Initialization

**Decision:** Resolver created with ProjectAdapter, empty until discovery populates it.

```typescript
function createProjectAdapter(pythonProject) {
    const resultResolver = new PythonResultResolver(
        this.testController,
        testProvider,
        pythonProject.uri,
        projectId  // Pass project ID for scoping
    )

    return {
        projectId,
        resultResolver,  // ← Empty maps, will be filled during discovery
        // ...
    }
}

// During discovery, resolver is populated
await project.resultResolver.resolveDiscovery(project.ownedTests, token)
```

---

### 9. Debug Integration

**Decision:** Debug launcher is project-aware, uses project's Python executable.

```typescript
async function executeTestsForProvider(project, testItems, ...) {
    await project.executionAdapter.runTests(
        project.projectUri,
        runIds,
        runInstance,
        this.pythonExecFactory,
        token,
        request.profile?.kind,
        this.debugLauncher,  // ← Launcher handles project executable
        project.pythonEnvironment  // ← Pass project's Python, not workspace
    )
}

// In executionAdapter
async function runTests(..., debugLauncher, pythonEnvironment) {
    if (isDebugging) {
        await debugLauncher.launchDebugger({
            testIds: runIds,
            interpreter: pythonEnvironment.execInfo.run.executable  // ← Project-specific
        })
    }
}
```

---

### 10. State Persistence

**Decision:** No persistence - everything rebuilds on VS Code reload.

- ✅ Rebuild `workspaceProjects` map during `activate()`
- ✅ Rebuild `vsIdToProject` map during discovery
- ✅ Rebuild TestItems during discovery
- ✅ Clear `rawDiscoveryData` after filtering (not persisted)

**Rationale:** Simpler, avoids stale state issues. Performance acceptable for typical workspaces (<100ms per project).

---

### 11. File Watching

**Decision:** Watchers are per-workspace (shared by all projects).

```typescript
// Single watcher for workspace, all projects react
watchForSettingsChanges(workspace) {
    pattern = new RelativePattern(workspace, "**/{settings.json,pytest.ini,...}")
    watcher = this.workspaceService.createFileSystemWatcher(pattern)

    watcher.onDidChange((uri) => {
        // NOTE: Inefficient - refreshes ALL projects in workspace
        // even if only one project's pytest.ini changed
        this.refreshTestData(uri)
    })
}
```

**Not per-project** because settings are per-workspace (see #3).

---

### 12. Empty/Loading States

**Decision:** Match current behavior - blank test explorer, then populate.

- Before first discovery: Empty test explorer (no items)
- During discovery: No loading indicators (happens fast enough)
- After discovery failure: Error nodes shown in tree

**No special UI** for loading states in initial implementation.

---

### 13. Coverage Integration

**Decision:** Push to future implementation - out of scope for initial release.

Coverage display questions deferred:
- Merging coverage from multiple projects
- Per-project coverage percentages
- Overlapping file coverage

Current `detailedCoverageMap` remains per-project; UI integration TBD.

---

## Implementation Notes

### Dynamic Adapter Management

**Current Issue:** testAdapters are created only during `activate()` and require extension reload to change.

**Required Changes:**
1. **Add Project Detection Service:** Listen to `pythonEnvApi.projects.onDidChangeProjects` event
2. **Dynamic Creation:** Create ProjectAdapter on-demand when new PythonProject detected
3. **Dynamic Removal:** Clean up ProjectAdapter when PythonProject removed:
   ```typescript
   async function removeProject(project: ProjectAdapter) {
       // 1. Remove from workspaceProjects map
       // 2. Clear all vsIdToProject entries
       // 3. Remove TestItems from TestController
       // 4. Dispose adapters and resolver
   }
   ```
4. **Hot Reload:** Trigger discovery for new projects without full extension restart

### Unittest Support

**Current Scope:** Focus on pytest-based projects initially.

**Future Work:** Unittest will use same ProjectAdapter pattern but:
- Different `discoveryAdapter` (UnittestTestDiscoveryAdapter)
- Different `executionAdapter` (UnittestTestExecutionAdapter)
- Same ownership resolution and ID mapping patterns
- Already supported in current architecture via `testProvider` field

**Not in Scope:** Mixed pytest/unittest within same project (projects are single-framework)
