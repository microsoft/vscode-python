/**
 * To run this file:
 * * npm install @octokit/rest
 * * node .github/workflows/getLabels.js
 */

const { Octokit } = require('@octokit/rest');
const github = new Octokit();
github.rest.issues
    .listLabelsForRepo({
        owner: 'microsoft',
        repo: 'vscode-python',
    })
    .then((result) => {
        const labels = result.data.map((label) => label.name);
        console.log(JSON.stringify(labels));
    });
