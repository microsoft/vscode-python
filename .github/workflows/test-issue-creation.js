/**
 * Test script for validating the CI failure issue creation logic
 * This simulates the GitHub Actions script to ensure it handles various scenarios correctly.
 */

// Mock GitHub context
const mockContext = {
    repo: {
        owner: 'microsoft',
        repo: 'vscode-python'
    }
};

// Mock GitHub API
const mockGitHub = {
    rest: {
        issues: {
            listForRepo: async ({ owner, repo, state, labels, per_page }) => {
                console.log(`✓ Called listForRepo with: owner=${owner}, repo=${repo}, state=${state}, labels=${labels}, per_page=${per_page}`);
                return {
                    data: [
                        // Simulate an existing recent issue
                        {
                            number: 12345,
                            title: 'CI Failure on main: lint',
                            created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
                            labels: [{ name: 'ci-failure' }]
                        },
                        // Simulate an old issue
                        {
                            number: 11111,
                            title: 'CI Failure on main: tests',
                            created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
                            labels: [{ name: 'ci-failure' }]
                        }
                    ]
                };
            },
            create: async ({ owner, repo, title, body, labels }) => {
                console.log(`✓ Would create new issue:`);
                console.log(`  Title: ${title}`);
                console.log(`  Labels: ${labels.join(', ')}`);
                return { data: { number: 99999 } };
            },
            createComment: async ({ owner, repo, issue_number, body }) => {
                console.log(`✓ Would add comment to issue #${issue_number}`);
                return { data: {} };
            }
        }
    }
};

// Test the logic from the workflow
async function testIssueCreationLogic(scenarioName, jobResults, expectNewIssue) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${scenarioName}`);
    console.log('='.repeat(60));

    const failedJobs = [];
    const jobs = {
        'build-vsix': jobResults.buildVsix || 'success',
        'lint': jobResults.lint || 'success',
        'check-types': jobResults.checkTypes || 'success',
        'python-tests': jobResults.pythonTests || 'success',
        'tests': jobResults.tests || 'success',
        'smoke-tests': jobResults.smokeTests || 'success'
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
    ${failedJobs.map(job => `- **${job}**`).join('\n')}
    
    **Workflow Run:** https://github.com/microsoft/vscode-python/actions/runs/123456789
    **Commit:** abc123def456
    **Commit Message:** Test commit
    **Author:** @testuser
    
    Please investigate and fix the failure.
    
    ---
    *This issue was automatically created by the CI system.*`;

    // Check for existing issues
    const existingIssues = await mockGitHub.rest.issues.listForRepo({
        owner: mockContext.repo.owner,
        repo: mockContext.repo.repo,
        state: 'open',
        labels: 'ci-failure',
        per_page: 100
    });

    // Look for recent issues (within last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentIssue = existingIssues.data.find(issue => {
        const issueDate = new Date(issue.created_at);
        return issueDate > oneDayAgo && issue.title.includes('CI Failure on main');
    });

    if (recentIssue) {
        await mockGitHub.rest.issues.createComment({
            owner: mockContext.repo.owner,
            repo: mockContext.repo.repo,
            issue_number: recentIssue.number,
            body: `## Additional CI Failure
            
            Another CI failure occurred:
            ${failedJobs.map(job => `- **${job}**`).join('\n')}
            
            **Workflow Run:** https://github.com/microsoft/vscode-python/actions/runs/123456789
            **Commit:** abc123def456
            **Commit Message:** Test commit
            **Author:** @testuser`
        });
        console.log(`✓ Would comment on existing issue #${recentIssue.number} instead of creating new one`);
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
            labels: ['ci-failure', 'bug', 'needs-triage']
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

    // Test 1: Single failure, recent issue exists
    await testIssueCreationLogic(
        'Single failure with recent issue (should comment)',
        { lint: 'failure' },
        false // expect comment, not new issue
    );

    // Test 2: Multiple failures, recent issue exists
    await testIssueCreationLogic(
        'Multiple failures with recent issue (should comment)',
        { lint: 'failure', tests: 'failure' },
        false // expect comment, not new issue
    );

    // Test 3: Failure with no recent issues (old issue exists but >24h)
    // Note: In the actual scenario, we filter for recent issues, so old ones don't count
    console.log('\n' + '='.repeat(60));
    console.log('Testing: Failure with no recent issues (should create new)');
    console.log('='.repeat(60));
    console.log('Modifying mock to return only old issues...');
    
    const oldListForRepo = mockGitHub.rest.issues.listForRepo;
    mockGitHub.rest.issues.listForRepo = async (params) => {
        const result = await oldListForRepo(params);
        // Filter out recent issues for this test
        result.data = result.data.filter(issue => {
            const issueDate = new Date(issue.created_at);
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return issueDate <= oneDayAgo;
        });
        return result;
    };
    
    await testIssueCreationLogic(
        'Failure with only old issues (should create new)',
        { pythonTests: 'failure' },
        true // expect new issue
    );

    // Restore original mock
    mockGitHub.rest.issues.listForRepo = oldListForRepo;

    console.log('\n' + '='.repeat(60));
    console.log('All tests completed!');
    console.log('='.repeat(60));
})();
