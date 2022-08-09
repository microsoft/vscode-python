/**
 * To run this file:
 * * npm install @octokit/rest
 * * node .github/workflows/getLabels.js
 *
 * This script assumes the maximum number of labels to be 100.
 */

const { Octokit } = require('@octokit/rest');
const github = new Octokit();
github.rest.issues
    .listLabelsForRepo({
        owner: 'microsoft',
        repo: 'vscode-python',
        per_page: 100,
    })
    .then((result) => {
        const labels = result.data.map((label) => label.name);
        console.log(
            '\nNumber of labels found:',
            labels.length,
            ", verify that it's the same as number of labels listed in https://github.com/microsoft/vscode-python/labels\n",
        );
        console.log(JSON.stringify(labels), '\n');
    });
