// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const util = require('util');
const lsOutputOpenedFile = path.join(__dirname, '..', 'lsoutputdisplayed.log');
let activated = false;
async function sleep(timeout) {
    return new Promise(resolve => setTimeout(resolve, timeout));
}
function activate(context) {
    const statusBarItemActivated = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000000);
    const lineColumnStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000000);
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000000);
    statusBarItem.command = 'workbench.action.quickOpen';
    statusBarItem.text = '1';
    statusBarItem.tooltip = 'Py';
    statusBarItem.show();
    lineColumnStatusBarItem.command = 'workbench.action.quickOpen';
    lineColumnStatusBarItem.text = '';
    lineColumnStatusBarItem.tooltip = 'PyLine';
    lineColumnStatusBarItem.show();

    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(lineColumnStatusBarItem);
    // Always display editor line, column in this statusbar.
    // Sometimes we cannot detect the line,column of editor (because that item in statubar is not visbible due to lack of realestate).
    // This will get around that problem.
    vscode.window.onDidChangeTextEditorSelection(e => {
        try {
            lineColumnStatusBarItem.text = `${e.textEditor.selection.start.line + 1},${e.textEditor.selection.start.character + 1}`;
        } catch {}
    });
    // vscode.window.onDidChangeActiveTextEditor()
    let lastSetText = '';
    let interval = undefined;
    function monitorEditor() {
        clearInterval(interval);
        interval = setInterval(() => {
            if (vscode.window.activeTextEditor) {
                try {
                    const newText = `${vscode.window.activeTextEditor.selection.start.line + 1},${vscode.window.activeTextEditor.selection.start.character + 1}`;
                    if (lastSetText === newText) {
                        return;
                    }
                    lastSetText = lineColumnStatusBarItem.text = newText;
                } catch {}
            }
        }, 500);
    }
    vscode.window.onDidChangeActiveTextEditor(monitorEditor);
    vscode.window.onDidChangeVisibleTextEditors(monitorEditor);
    vscode.commands.registerCommand('smoketest.activatePython', async () => {
        if (activated) {
            return;
        }
        // lsOutputDisplayed.text = '';
        const ext = vscode.extensions.getExtension('ms-python.python');
        if (!ext.isActive) {
            await ext.activate();
            console.log('Bootstrap extension');
            console.log('ext.exports');
            console.log(ext.exports);
            // Wait for extension to complete.
            await ext.exports.ready;
        }
        statusBarItemActivated.text = '2';
        statusBarItemActivated.tooltip = 'Py2';
        // Don't remove this command, else the CSS selector for this will be different.
        // VSC will render a span if there's no span.
        statusBarItemActivated.command = 'workbench.action.quickOpen';
        statusBarItemActivated.show();

        activated = true;
        context.subscriptions.push(statusBarItemActivated);
    });
    vscode.commands.registerCommand('smoketest.viewLanguageServerOutput', async () => {
        // Keep trying until command can be executed without any errors.
        // If there are errors, this means the command hasn't (yet) been registered by the extension.
        for (let i = 0; i < 100000; i += 1) {
            sleep(10);
            const success = await new Promise((resolve, reject) => vscode.commands.executeCommand('python.viewLanguageServerOutput').then(resolve, reject))
                .then(() => true)
                .catch(() => false);
            if (!success) {
                continue;
            }
        }
        // Creating this file indicates the fact that the command was executed successfully.
        // The existence of this file is checked by the ui tests.
        await new Promise(resolve => fs.writeFile(lsOutputOpenedFile, '', resolve));
    });
    vscode.commands.registerCommand('smoketest.runInTerminal', async () => {
        const filePath = path.join(__dirname, '..', 'commands.txt');
        const command = fs
            .readFileSync(filePath)
            .toString()
            .trim();
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
            const configTarget =
                setting.type === 'user'
                    ? vscode.ConfigurationTarget.Global
                    : setting.type === 'workspace'
                    ? vscode.ConfigurationTarget.Workspace
                    : vscode.ConfigurationTarget.WorkspaceFolder;

            if (configTarget === vscode.ConfigurationTarget.WorkspaceFolder && !setting.workspaceFolder) {
                vscode.window.showErrorMessage('Workspace Folder not defined for udpate/remove of settings');
                throw new Error('Workspace Folder not defined');
            }

            const resource = setting.workspaceFolder ? vscode.Uri.file(setting.workspaceFolder) : undefined;

            for (let settingToRemove in setting.remove || []) {
                const parentSection = settingToRemove.split('.')[0];
                const childSection = settingToRemove
                    .split('.')
                    .filter((_, i) => i > 0)
                    .join('.');
                const settings = vscode.workspace.getConfiguration(parentSection, resource);
                await settings.update(childSection, undefined, configTarget);
            }
            for (let settingToAddUpdate in setting.update || []) {
                const parentSection = settingToAddUpdate.split('.')[0];
                const childSection = settingToAddUpdate
                    .split('.')
                    .filter((_, i) => i > 0)
                    .join('.');
                const settings = vscode.workspace.getConfiguration(parentSection, resource);
                await settings.update(childSection, setting.update[settingToAddUpdate], configTarget);
            }
            fs.unlinkSync(filePath);
        } catch (ex) {
            fs.appendFileSync(path.join(__dirname, '..', 'settingsToUpdate_error.txt'), util.format(ex));
        }
    });
    vscode.commands.registerCommand('smoketest.openFile', async () => {
        const file = fs
            .readFileSync(path.join(__dirname, '..', 'commands.txt'))
            .toString()
            .trim();
        const doc = await vscode.workspace.openTextDocument(file);
        await vscode.window.showTextDocument(doc);
    });
    // Custom command to stop debug sessions.
    // Basically we need a way to stop any existing debug sessions.
    // Using the vsc command, as we can invoke it even if a debugger isn't running.
    // We can use the command `Debug: Stop` from the command palette only if a debug session is active.
    // Using this approach we can send a command regardless, easy.
    vscode.commands.registerCommand('smoketest.stopDebuggingPython', async () => {
        try {
            await vscode.commands.executeCommand('workbench.action.debug.stop');
        } catch {
            // Do nothing.
        }
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
    return JSON.parse(
        fs
            .readFileSync(filePath)
            .toString()
            .trim()
    );
}
exports.activate = activate;
function deactivate() {
    // Do nothing.
}
exports.deactivate = deactivate;
