/**
 * Test script for validating the CI failure issue creation logic
 * This simulates the GitHub Actions script to ensure it handles various scenarios correctly.
 */

// Mock GitHub context
const mockContext = {
    repo: {
        owner: 'microsoft',
        repo: 'vscode-python',
    },
};

// Mock GitHub API
const mockGitHub = {
    rest: {
        issues: {
            listForRepo: async ({ owner, repo, state, labels, per_page }) => {
                console.log(
                    `✓ Called listForRepo with: owner=${owner}, repo=${repo}, state=${state}, labels=${labels}, per_page=${per_page}`,
                );
                return {
                    data: [
                        // Simulate an existing open issue created by this workflow.
                        {
                            number: 12345,
                            title: 'CI Failure on main: lint',
                            created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
                            labels: [{ name: 'ci-failure' }],
                        },
                        // Simulate another open issue (age doesn't matter for the new rule).
                        {
                            number: 11111,
                            title: 'CI Failure on main: tests',
                            created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
                            labels: [{ name: 'ci-failure' }],
                        },
                    ],
                };
            },
            create: async ({ owner, repo, title, body, labels }) => {
                console.log(`✓ Would create new issue:`);
                console.log(`  Title: ${title}`);
                console.log(`  Labels: ${labels.join(', ')}`);
                return { data: { number: 99999 } };
            },
            createComment: async ({ owner, repo, issue_number, body }) => {
                console.log(`✓ Would create comment on issue #${issue_number}`);
                return { data: { id: 44444 } };
            },
            listComments: async ({ owner, repo, issue_number, per_page }) => {
                console.log(
                    `✓ Called listComments with: owner=${owner}, repo=${repo}, issue_number=${issue_number}, per_page=${per_page}`,
                );
                return { data: [] };
            },
            updateComment: async ({ owner, repo, comment_id, body }) => {
                console.log(`✓ Would update comment #${comment_id}`);
                return { data: {} };
            },
        },
    },
};

// Test the logic from the workflow
async function testIssueCreationLogic(scenarioName, jobResults, expectNewIssue) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${scenarioName}`);
    console.log('='.repeat(60));

    const failedJobs = [];
    const jobs = {
        'build-vsix': jobResults.buildVsix || 'success',
        lint: jobResults.lint || 'success',
        'check-types': jobResults.checkTypes || 'success',
        'python-tests': jobResults.pythonTests || 'success',
        tests: jobResults.tests || 'success',
        'smoke-tests': jobResults.smokeTests || 'success',
    };

    for (const [job, result] of Object.entries(jobs)) {
        if (result === 'failure') {
            failedJobs.push(job);
        }
    }

    console.log(`Failed jobs: ${failedJobs.join(', ') || 'none'}`);

    if (failedJobs.length === 0) {
        console.log('✓ No failures - workflow would not run');
        return;
    }

    const title = `CI Failure on main: ${failedJobs.join(', ')}`;
    const body = `## CI Failure Report

    The following jobs failed on the main branch:
    ${failedJobs.map((job) => `- **${job}**`).join('\n')}

    **Workflow Run:** https://github.com/microsoft/vscode-python/actions/runs/123456789
    **Commit:** abc123def456
    **Commit Message:** Test commit
    **Author:** @testuser

    Please investigate and fix the failure.

    ---
    *This issue was automatically created by the CI system.*`;

    const logMarker = '<!-- ci-failure-log -->';
    const logHeader = `${logMarker}\n## CI Failure Log\n\n`;
    const entrySeparator = '\n\n---\n\n';

    const newEntry = `### ${new Date().toISOString()}

    Failed jobs:
    ${failedJobs.map((job) => `- **${job}**`).join('\n')}

    **Workflow Run:** https://github.com/microsoft/vscode-python/actions/runs/123456789
    **Commit:** abc123def456
    **Commit Message:** Test commit
    **Author:** testuser`;

    // Check for existing issues
    const existingIssues = await mockGitHub.rest.issues.listForRepo({
        owner: mockContext.repo.owner,
        repo: mockContext.repo.repo,
        state: 'open',
        labels: 'ci-failure',
        per_page: 100,
    });

    // New rule: If there is any open CI failure issue, update a single rolling log comment there.
    // Prefer issues created by this workflow (title match), otherwise fall back to the first open issue.
    const existingIssue =
        existingIssues.data.find((issue) => issue.title.includes('CI Failure on main')) ?? existingIssues.data[0];

    if (existingIssue) {
        const comments = await mockGitHub.rest.issues.listComments({
            owner: mockContext.repo.owner,
            repo: mockContext.repo.repo,
            issue_number: existingIssue.number,
            per_page: 100,
        });

        const existingLogComment = comments.data.find((c) => typeof c.body === 'string' && c.body.includes(logMarker));
        if (existingLogComment) {
            const existingBody = existingLogComment.body || '';
            const existingEntriesText = existingBody.startsWith(logHeader)
                ? existingBody.slice(logHeader.length)
                : existingBody;
            const existingEntries = existingEntriesText
                .split(entrySeparator)
                .map((s) => s.trim())
                .filter(Boolean);

            const updatedEntries = [newEntry.trim(), ...existingEntries].slice(0, 20);
            const updatedBody = logHeader + updatedEntries.join(entrySeparator);
            await mockGitHub.rest.issues.updateComment({
                owner: mockContext.repo.owner,
                repo: mockContext.repo.repo,
                comment_id: existingLogComment.id,
                body: updatedBody,
            });
            console.log(`✓ Would update existing CI log comment on issue #${existingIssue.number}`);
        } else {
            await mockGitHub.rest.issues.createComment({
                owner: mockContext.repo.owner,
                repo: mockContext.repo.repo,
                issue_number: existingIssue.number,
                body: logHeader + newEntry.trim(),
            });
            console.log(`✓ Would create CI log comment on existing issue #${existingIssue.number}`);
        }
        if (expectNewIssue) {
            console.error('❌ FAILED: Expected new issue but would comment instead');
        } else {
            console.log('✓ PASSED: Correctly prevented duplicate issue');
        }
    } else {
        const issue = await mockGitHub.rest.issues.create({
            owner: mockContext.repo.owner,
            repo: mockContext.repo.repo,
            title: title,
            body: body,
            labels: ['ci-failure', 'bug', 'needs-triage'],
        });
        console.log(`✓ Would create new issue #${issue.data.number}`);
        if (!expectNewIssue) {
            console.error('❌ FAILED: Created new issue but should have commented');
        } else {
            console.log('✓ PASSED: Correctly created new issue');
        }
    }
}

// Run test scenarios
(async () => {
    console.log('Starting CI Failure Issue Creation Tests...\n');

    // Test 1: Single failure, an open CI failure issue exists (no log comment yet -> create it)
    await testIssueCreationLogic(
        'Single failure with existing open issue (should create log comment)',
        { lint: 'failure' },
        false, // expect comment, not new issue
    );

    // Test 2: Single failure, open issue exists and log comment exists -> update it
    console.log('\n' + '='.repeat(60));
    console.log('Testing: Open issue with existing log comment (should update)');
    console.log('='.repeat(60));

    const oldListComments = mockGitHub.rest.issues.listComments;
    mockGitHub.rest.issues.listComments = async (params) => {
        await oldListComments(params);
        return {
            data: [
                {
                    id: 77777,
                    body:
                        '<!-- ci-failure-log -->\n## CI Failure Log\n\n### 2025-01-01T00:00:00.000Z\n\nFailed jobs:\n- **lint**',
                },
            ],
        };
    };

    await testIssueCreationLogic(
        'Single failure with existing log comment (should update)',
        { tests: 'failure' },
        false,
    );

    mockGitHub.rest.issues.listComments = oldListComments;

    // Test 3: Multiple failures, an open CI failure issue exists
    await testIssueCreationLogic(
        'Multiple failures with existing open issue (should create or update log comment)',
        { lint: 'failure', tests: 'failure' },
        false, // expect comment, not new issue
    );

    // Test 4: Failure with no open CI failure issues
    console.log('\n' + '='.repeat(60));
    console.log('Testing: Failure with no open issues (should create new)');
    console.log('='.repeat(60));
    console.log('Modifying mock to return no issues...');

    const oldListForRepo = mockGitHub.rest.issues.listForRepo;
    mockGitHub.rest.issues.listForRepo = async (params) => {
        await oldListForRepo(params);
        return { data: [] };
    };

    await testIssueCreationLogic(
        'Failure with no open issues (should create new)',
        { pythonTests: 'failure' },
        true, // expect new issue
    );

    // Restore original mock
    mockGitHub.rest.issues.listForRepo = oldListForRepo;

    console.log('\n' + '='.repeat(60));
    console.log('All tests completed!');
    console.log('='.repeat(60));
})();
