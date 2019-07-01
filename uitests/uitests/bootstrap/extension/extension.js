// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require('fs');
const path = require('path');
const util = require('util');

let activated = false;
async function sleep(timeout) {
    return new Promise(resolve => setTimeout(resolve, timeout));
}
function activate(context) {
    const statusBarItemActivated = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000000);
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000000);
    statusBarItem.command = 'workbench.action.quickOpen';
    statusBarItem.text = 'Py';
    statusBarItem.tooltip = 'Py';
    statusBarItem.show();

    context.subscriptions.push(statusBarItem);
    // Always display editor line, column in this statusbar.
    // Sometimes we cannot detect the line,column of editor (because that item in statubar is not visbible due to lack of realestate).
    // This will get around that problem.
    vscode.window.onDidChangeTextEditorSelection(e => {
        try {
            statusBarItemActivated.text = `${e.textEditor.selection.start.line + 1},${e.textEditor.selection.start.character + 1}`;
        } catch { }
    });
    vscode.commands.registerCommand('smoketest.activatePython', async () => {
        if (activated) {
            return;
        }
        const ext = vscode.extensions.getExtension('ms-python.python');
        if (!ext.isActive) {
            await ext.activate();
        }
        statusBarItemActivated.text = 'Py2';
        statusBarItemActivated.tooltip = 'Py2';
        // Don't remove this command, else the CSS selector for this will be different.
        // VSC will render a span if there's no span.
        statusBarItemActivated.command = 'workbench.action.quickOpen';
        statusBarItemActivated.show();

        activated = true;
        context.subscriptions.push(statusBarItemActivated);
    });
    vscode.commands.registerCommand('smoketest.runInTerminal', async () => {
        const filePath = path.join(__dirname, '..', 'commands.txt');
        const command = fs.readFileSync(filePath).toString().trim();
        for (let counter = 0; counter < 5; counter++) {
            if (!vscode.window.activeTerminal) {
                await sleep(5000);
            }
        }
        if (!vscode.window.activeTerminal) {
            vscode.window.createTerminal('Manual');
            await sleep(5000);
        }
        if (!vscode.window.activeTerminal) {
            vscode.window.showErrorMessage('No Terminal in Bootstrap Extension');
        }
        await vscode.window.activeTerminal.sendText(command, true);
        fs.unlinkSync(filePath);
    });
    vscode.commands.registerCommand('smoketest.updateSettings', async () => {
        const filePath = path.join(__dirname, '..', 'settingsToUpdate.txt');
        try {
            const setting = getSettingsToUpdateRemove(filePath);
            const configTarget = setting.type === 'user' ? vscode.ConfigurationTarget.Global :
                (setting.type === 'workspace' ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.WorkspaceFolder);

            if (configTarget === vscode.ConfigurationTarget.WorkspaceFolder && !setting.workspaceFolder) {
                vscode.window.showErrorMessage('Workspace Folder not defined for udpate/remove of settings');
                throw new Error('Workspace Folder not defined');
            }

            const resource = setting.workspaceFolder ? vscode.Uri.file(setting.workspaceFolder) : undefined;

            for (let settingToRemove in (setting.remove || [])) {
                const parentSection = settingToRemove.split('.')[0];
                const childSection = settingToRemove.split('.').filter((_, i) => i > 0).join('.');
                const settings = vscode.workspace.getConfiguration(parentSection, resource);
                await settings.update(childSection, undefined, configTarget);
            }
            for (let settingToAddUpdate in (setting.update || [])) {
                const parentSection = settingToAddUpdate.split('.')[0];
                const childSection = settingToAddUpdate.split('.').filter((_, i) => i > 0).join('.');
                const settings = vscode.workspace.getConfiguration(parentSection, resource);
                await settings.update(childSection, setting.update[settingToAddUpdate], configTarget);
            }
            fs.unlinkSync(filePath);
        } catch (ex) {
            fs.appendFileSync(path.join(__dirname, '..', 'settingsToUpdate_error.txt'), util.format(ex));
        }
    });
    vscode.commands.registerCommand('smoketest.openFile', async () => {
        const file = fs.readFileSync(path.join(__dirname, '..', 'commands.txt')).toString().trim();
        const doc = await vscode.workspace.openTextDocument(file);
        await vscode.window.showTextDocument(doc)
    });
}

/**
* @typedef {Object} SettingsToUpdate - creates a new type named 'SpecialType'
* @property {'user' | 'workspace' | 'workspaceFolder'} [type] - Type.
* @property {?string} workspaceFolder - Workspace Folder
* @property {Object.<string, object>} update - Settings to update.
* @property {Array<string>} remove - Skip format checks.
*/

/**
 *
 *
 * @param {*} filePath
 * @return {SettingsToUpdate} Settings to update/remove.
 */
function getSettingsToUpdateRemove(filePath) {
    return JSON.parse(fs.readFileSync(filePath).toString().trim());
}
exports.activate = activate;
function deactivate() {
    // Do nothing.
}
exports.deactivate = deactivate;
