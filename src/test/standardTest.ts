import * as path from 'path';

process.env.CODE_TESTS_WORKSPACE = path.join(__dirname, '..', '..', 'src', 'test');

function start() {
    require('../../node_modules/vscode/bin/test');
}
start();
