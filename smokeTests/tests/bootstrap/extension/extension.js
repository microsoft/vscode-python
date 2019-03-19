// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
function activate(context) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000000);
    statusBarItem.command = 'workbench.action.quickOpen';
    statusBarItem.text = 'PySmoke';
    statusBarItem.tooltip = 'PySmoke';
    statusBarItem.show();

    context.subscriptions.push(statusBarItem);

    const ext = vscode.extensions.getExtension('ms-python.python');
    if (!ext.isActive){
        ext.activate();
    }

    vscode.commands.registerCommand('smoketest.activatePython', async ()=>{
        const ext = vscode.extensions.getExtension('ms-python.python');
        if (!ext.isActive){
            await ext.activate();
        }
        vscode.window.showInformationMessage('Python Extension Activated');
    })
}

exports.activate = activate;
function deactivate() {
    // Do nothing.
}
exports.deactivate = deactivate;
