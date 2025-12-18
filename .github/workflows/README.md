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
   - Checking for any existing open issues with the `ci-failure` label
   - Updating a single rolling "CI Failure Log" comment on the existing issue (edits in-place to reduce notification noise)

3. **Provides actionable information** including:
   - Workflow run URL for detailed logs
   - Commit details for quick identification
   - Author mention for notification

**Example issue title:** `CI Failure on main: lint, tests`

**Example issue body (abbreviated):**
```markdown
## CI Failure Report

The following jobs failed on the main branch:
- **lint**
- **tests**

**Workflow Run:** <link>
**Commit:** <sha>
**Commit Message:** <message>
**Author:** @<user>
```

#### Configuration

The automatic issue filing is controlled by:
- **Repository check:** Only runs for `microsoft/vscode-python`
- **Branch check:** Only runs on `refs/heads/main`
- **Permissions:** Requires `issues: write` permission
- **Dependencies:** Runs after all test jobs complete using `needs` and `always()`

#### Local validation

The issue filing logic is validated by the script in `.github/workflows/test-issue-creation.js`.

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
