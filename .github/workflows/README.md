# GitHub Actions Workflows

This directory contains the CI/CD workflows for the vscode-python extension.

## Main Workflows

### build.yml
The main CI pipeline that runs on pushes to `main`, `release`, and `release/*` branches. This workflow:
- Builds VSIX packages for multiple platforms
- Runs linting and type checking
- Executes Python and TypeScript tests
- Performs smoke tests
- **Automatically files issues when CI fails on main branch**

#### Automatic Issue Filing on Failures

When any job in the build workflow fails on the `main` branch, the `report-failure` job automatically:

1. **Creates a GitHub issue** with:
   - List of failed jobs
   - Direct link to the failed workflow run
   - Commit information (SHA, message, author)
   - Labels: `ci-failure`, `bug`, `needs-triage`

2. **Prevents duplicate issues** by:
   - Checking for existing open issues with the `ci-failure` label
   - Adding a comment to recent issues (within 24 hours) instead of creating duplicates

3. **Provides actionable information** including:
   - Workflow run URL for detailed logs
   - Commit details for quick identification
   - Author mention for notification

**Example Issue Title:**
```
CI Failure on main: lint, tests
```

**Example Issue Body:**
```markdown
## CI Failure Report

The following jobs failed on the main branch:
- **lint**
- **tests**

**Workflow Run:** https://github.com/microsoft/vscode-python/actions/runs/123456789
**Commit:** abc123def456
**Commit Message:** Fix test flakiness
**Author:** @username

Please investigate and fix the failure.

---
*This issue was automatically created by the CI system.*
```

#### Configuration

The automatic issue filing is controlled by:
- **Repository check:** Only runs for `microsoft/vscode-python`
- **Branch check:** Only runs on `refs/heads/main`
- **Permissions:** Requires `issues: write` permission
- **Dependencies:** Runs after all test jobs complete using `needs` and `always()`

### pr-check.yml
Runs on pull requests and non-main branches. Similar to build.yml but does not include automatic issue filing.

### Other Workflows
- `info-needed-closer.yml`: Closes stale issues needing more information
- `issue-labels.yml`: Manages issue labeling
- `pr-labels.yml`: Manages pull request labeling
- `lock-issues.yml`: Locks old issues
- `codeql-analysis.yml`: Security scanning with CodeQL

## Permissions

Workflows use minimal permissions following the principle of least privilege:
- Most workflows: No permissions (`permissions: {}`)
- Issue management workflows: `issues: write`
- Build workflow report-failure job: `issues: write`

## Workflow Maintenance

When modifying workflows:
1. Test YAML syntax: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/<workflow>.yml'))"`
2. Verify GitHub Actions syntax using the Actions tab
3. Consider impact on both PRs and main branch
4. Update this documentation if changing significant behavior
