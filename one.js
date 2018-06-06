const cp = require('child_process');

const python_path = '/Users/donjayamanne/Desktop/Development/PythonStuff/IssueRepos/vscode-python-78/venv/bin/python'
const out = cp.spawnSync(python_path, ['-m', 'nose', '-h']).stdout.toString();

// const withArgs = getMatches("[^\\S+](-{1}[a-zA-Z0-9]+) [^ ]+", out).concat(getMatches("[^\\S+](-{2}[a-zA-Z0-9-]+)(=| )[^ ]+", out));
const withArgs = getMatches("\\s{1,}(-{1,2}[A-Za-z0-9-]+)(?:=|\\s{0,1}[A-Z])", out);

// const withoutArgs = getMatches("[^\\S+](-{1}[a-zA-Z0-9]+)(?:,|\\S{1,})", out).concat(getMatches("[^\\S+](-{2}[a-zA-Z0-9]+)(?:,|\\S{1,})", out));
const withoutArgs = getMatches("\\s{1,}(-{1,2}[A-Za-z0-9-]+(?:,|\\s{2,}))", out);

const output = [
    { withArgs },
    // { withoutArgs }
];
console.log(JSON.stringify(output));

function getMatches(pattern, str) {
    const matches = [];
    const regex = new RegExp(pattern, "gm");
    while ((result = regex.exec(str)) !== null) {
        if (result.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        // console.log(result[0]);
        // console.log(result[1]);
        // console.log(result[2]);
        matches.push(result[1].trim());
    }
    return matches
        .sort((a, b) => a.toLocaleLowerCase() < b.toLocaleLowerCase() ? -1 : 1)
        .reduce((items, item) => items.indexOf(item) === -1 ? items.concat([item]) : items, []);
}
