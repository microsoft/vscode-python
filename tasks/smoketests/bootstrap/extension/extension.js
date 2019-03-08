// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
function activate(context) {
    const rootDir = getVSCRootDirectory();
    const configFile = path.join(rootDir, 'smokin.cfg')
    console.info(`Smoke Test config file = ${configFile}`);
    if (Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0) {
        const folder = fs.readFileSync(configFile).toString()
        if (folder.toUpperCase() === vscode.workspace.workspaceFolders[0].uri.fsPath.toUpperCase()) {
            vscode.window.showInformationMessage('We are smokin!');
        } else {
            vscode.window.showErrorMessage('Wrong folder opened');
        }
    } else {
        vscode.window.showErrorMessage('We are read to smoke something');
    }
    const disposable = vscode.commands.registerCommand('smoketest.openworkspace', () => {
        const folder = fs.readFileSync(configFile).toString()
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folder));
    });
    context.subscriptions.push(disposable);
}

function getVSCRootDirectory() {
    let dir = path.dirname(process.execPath);
    while (dir.length > 0) {
        if (path.basename(dir) === 'Frameworks') {
            return path.dirname(path.dirname(path.dirname(dir)));
        }
        dir = path.dirname(dir);
    }
    return '';
}
exports.activate = activate;
function deactivate() {
    // Do nothing.
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map
