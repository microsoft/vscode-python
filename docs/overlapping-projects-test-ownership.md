# Overlapping Projects and Test Ownership Resolution

## Problem Statement

When Python projects have nested directory structures, test discovery can result in the same test file being discovered by multiple projects. We need a deterministic way to assign each test to exactly one project.

## Scenario Example

### Project Structure

```
root/alice/                          ← ProjectA root
├── .venv/                           ← ProjectA's Python environment
│   └── bin/python
├── alice_test.py
│   ├── test: t1
│   └── test: t2
└── bob/                             ← ProjectB root (nested)
    ├── .venv/                       ← ProjectB's Python environment
    │   └── bin/python
    └── bob_test.py
        └── test: t1
```

### Project Definitions

| Project   | URI               | Python Executable                    |
|-----------|-------------------|--------------------------------------|
| ProjectA  | `root/alice`      | `root/alice/.venv/bin/python`       |
| ProjectB  | `root/alice/bob`  | `root/alice/bob/.venv/bin/python`   |

### Discovery Results

#### ProjectA Discovery (on `root/alice/`)

Discovers 3 tests:
1. ✓ `root/alice/alice_test.py::t1`
2. ✓ `root/alice/alice_test.py::t2`
3. ✓ `root/alice/bob/bob_test.py::t1` ← **Found in subdirectory**

#### ProjectB Discovery (on `root/alice/bob/`)

Discovers 1 test:
1. ✓ `root/alice/bob/bob_test.py::t1` ← **Same test as ProjectA found!**

### Conflict

**Both ProjectA and ProjectB discovered:** `root/alice/bob/bob_test.py::t1`

Which project should own this test in the Test Explorer?

## Resolution Strategy

### Using PythonProject API as Source of Truth

The `vscode-python-environments` extension provides:
```typescript
interface PythonProject {
    readonly name: string;
    readonly uri: Uri;
}

// Query which project owns a specific URI
getPythonProject(uri: Uri): Promise<PythonProject | undefined>
```

### Resolution Process

For the conflicting test `root/alice/bob/bob_test.py::t1`:

```typescript
// Query: Which project owns this file?
const project = await getPythonProject(Uri.file("root/alice/bob/bob_test.py"));

// Result: ProjectB (the most specific/nested project)
// project.uri = "root/alice/bob"
```

### Final Test Ownership

| Test                              | Discovered By      | Owned By   | Reason                                    |
|-----------------------------------|-------------------|------------|-------------------------------------------|
| `root/alice/alice_test.py::t1`    | ProjectA          | ProjectA   | Only discovered by ProjectA               |
| `root/alice/alice_test.py::t2`    | ProjectA          | ProjectA   | Only discovered by ProjectA               |
| `root/alice/bob/bob_test.py::t1`  | ProjectA, ProjectB | **ProjectB** | API returns ProjectB for this URI |

## Implementation Rules

### 1. Discovery Runs Independently
Each project runs discovery using its own Python executable and configuration, discovering all tests it can find (including subdirectories).

### 2. Detect Overlaps and Query API Only When Needed
After all projects complete discovery, detect which test files were found by multiple projects:
```typescript
// Build map of test file -> projects that discovered it
const testFileToProjects = new Map<string, Set<string>>();
for (const project of allProjects) {
    for (const testFile of project.discoveredTestFiles) {
        if (!testFileToProjects.has(testFile.path)) {
            testFileToProjects.set(testFile.path, new Set());
        }
        testFileToProjects.get(testFile.path).add(project.id);
    }
}

// Query API only for overlapping tests or tests within nested projects
for (const [filePath, projectIds] of testFileToProjects) {
    if (projectIds.size > 1) {
        // Multiple projects found it - use API to resolve
        const owner = await getPythonProject(Uri.file(filePath));
        assignToProject(owner.uri, filePath);
    } else if (hasNestedProjectForPath(filePath, allProjects)) {
        // Only one project found it, but nested project exists - verify with API
        const owner = await getPythonProject(Uri.file(filePath));
        assignToProject(owner.uri, filePath);
    } else {
        // Unambiguous - assign to the only project that found it
        assignToProject([...projectIds][0], filePath);
    }
}
```

This optimization reduces API calls significantly since most projects don't have overlapping discovery.

### 3. Filter Discovery Results
ProjectA's final tests:
```typescript
const projectATests = discoveredTests.filter(test =>
    getPythonProject(test.uri) === projectA
);
// Result: Only alice_test.py tests remain
```

ProjectB's final tests:
```typescript
const projectBTests = discoveredTests.filter(test =>
    getPythonProject(test.uri) === projectB
);
// Result: Only bob_test.py tests remain
```

### 4. Add to TestController
Each project only adds tests that the API says it owns:
```typescript
// ProjectA adds its filtered tests under ProjectA node
populateTestTree(testController, projectATests, projectANode, projectAResolver);

// ProjectB adds its filtered tests under ProjectB node
populateTestTree(testController, projectBTests, projectBNode, projectBResolver);
```

## Test Explorer UI Result

```
📁 Workspace: root
  📦 Project: ProjectA (root/alice)
    📄 alice_test.py
      ✓ t1
      ✓ t2
  📦 Project: ProjectB (root/alice/bob)
    📄 bob_test.py
      ✓ t1
```

## Edge Cases

### Case 1: No Project Found
```typescript
const project = await getPythonProject(testUri);
if (!project) {
    // File is not part of any project
    // Could belong to workspace-level tests (fallback)
}
```

### Case 2: Project Changed After Discovery
If a test file's project assignment changes (e.g., user creates new `pyproject.toml`), the next discovery cycle will re-assign ownership correctly.

### Case 3: Deeply Nested Projects
```
root/a/          ← ProjectA
  root/a/b/      ← ProjectB
    root/a/b/c/  ← ProjectC
```

API always returns the **most specific** (deepest) project for a given URI.

## Algorithm Summary

```typescript
async function assignTestsToProjects(
    allProjects: ProjectAdapter[],
    testController: TestController
): Promise<void> {
    for (const project of allProjects) {
        // 1. Run discovery with project's Python executable
        const discoveredTests = await project.discoverTests();

        // 2. Filter to tests actually owned by this project
        const ownedTests = [];
        for (const test of discoveredTests) {
            const owningProject = await getPythonProject(test.uri);
    // 1. Run discovery for all projects
    await Promise.all(allProjects.map(p => p.discoverTests()));

    // 2. Build overlap detection map
    const testFileToProjects = new Map<string, Set<ProjectAdapter>>();
    for (const project of allProjects) {
        for (const testFile of project.discoveredTestFiles) {
            if (!testFileToProjects.has(testFile.path)) {
                testFileToProjects.set(testFile.path, new Set());
            }
            testFileToProjects.get(testFile.path).add(project);
        }
    }

    // 3. Resolve ownership (query API only when needed)
    const testFileToOwner = new Map<string, ProjectAdapter>();
    for (const [filePath, projects] of testFileToProjects) {
        if (projects.size === 1) {
            // No overlap - assign to only discoverer
            const project = [...projects][0];
            // Still check if nested project exists for this path
            if (!hasNestedProjectForPath(filePath, allProjects, project)) {
                testFileToOwner.set(filePath, project);
                continue;
            }
        }

        // Overlap or nested project exists - use API as source of truth
        const owningProject = await getPythonProject(Uri.file(filePath));
        if (owningProject) {
            const project = allProjects.find(p => p.projectUri.fsPath === owningProject.uri.fsPath);
            if (project) {
                testFileToOwner.set(filePath, project);
            }
        }
    }

    // 4. Add tests to their owning project's tree
    for (const [filePath, owningProject] of testFileToOwner) {
        const tests = owningProject.discoveredTestFiles.get(filePath);
        populateProjectTestTree(owningProject, tests);
    }
}

function hasNestedProjectForPath(
    testFilePath: string,
    allProjects: ProjectAdapter[],
    excludeProject?: ProjectAdapter
): boolean {
    return allProjects.some(p =>
        p !== excludeProject &&
        testFilePath.startsWith(p.projectUri.fsPath)
    );project-based ownership, TestItem IDs must include project context:
```typescript
// Instead of: "/root/alice/bob/bob_test.py::t1"
// Use: "projectB::/root/alice/bob/bob_test.py::t1"
testItemId = `${projectId}::${testPath}`;
```

### Discovery Filtering in populateTestTree

The `populateTestTree` function needs to be project-aware:
```typescript
export async function populateTestTree(
    testController: TestController,
    testTreeData: DiscoveredTestNode,
    testRoot: TestItem | undefined,
    resultResolver: ITestResultResolver,
    projectId: string,
    getPythonProject: (uri: Uri) => Promise<PythonProject | undefined>,
    token?: CancellationToken,
): Promise<void> {
    // For each discovered test, check ownership
    for (const testNode of testTreeData.children) {
        const testFileUri = Uri.file(testNode.path);
        const owningProject = await getPythonProject(testFileUri);

        // Only add if this project owns the test
        if (owningProject?.uri.fsPath === projectId.split('::')[0]) {
            // Add test to tree
            addTestItemToTree(testController, testNode, testRoot, projectId);
        }
    }
}
```

### ResultResolver Scoping

Each project's ResultResolver maintains mappings only for tests it owns:
```typescript
class PythonResultResolver {
    constructor(
        testController: TestController,
        testProvider: TestProvider,
        workspaceUri: Uri,
        projectId: string  // Scopes all IDs to this project
    ) {
        this.projectId = projectId;
    }

    // Maps include projectId prefix
    runIdToTestItem: Map<string, TestItem>  // "projectA::test.py::t1" -> TestItem
    runIdToVSid: Map<string, string>        // "projectA::test.py::t1" -> vsCodeId
    vsIdToRunId: Map<string, string>        // vsCodeId -> "projectA::test.py::t1"
}
```

---

**Key Takeaway**: Discovery finds tests broadly; the PythonProject API decides ownership narrowly.
