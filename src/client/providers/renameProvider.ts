'use strict';

import * as vscode from 'vscode';
import { RefactorProxy } from '../refactor/proxy';
import { getWorkspaceEditsFromPatch } from '../common/editor';
import * as path from 'path';
import { PythonSettings } from '../common/configSettings';
import { Installer, Product } from '../common/installer';

const EXTENSION_DIR = path.join(__dirname, '..', '..', '..');
interface RenameResponse {
    results: [{ diff: string }];
}

export class PythonRenameProvider implements vscode.RenameProvider {
    private installer: Installer;
    constructor(private outputChannel: vscode.OutputChannel) {
        this.installer = new Installer(outputChannel);
    }
    public provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): Thenable<vscode.WorkspaceEdit> {
        return vscode.workspace.saveAll(false).then(() => {
            return this.doRename(document, position, newName, token);
        });
    }

    private doRename(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): Thenable<vscode.WorkspaceEdit> {
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return;
        }
        if (position.character <= 0) {
            return;
        }

        var range = document.getWordRangeAtPosition(position);
        if (!range || range.isEmpty) {
            return;
        }
        const oldName = document.getText(range);
        if (oldName === newName) {
            return;
        }

        let workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder && Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0) {
            workspaceFolder = vscode.workspace.workspaceFolders[0];
        }
        const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : __dirname;
        const pythonSettings = PythonSettings.getInstance(workspaceFolder ? workspaceFolder.uri : undefined);

        let proxy = new RefactorProxy(EXTENSION_DIR, pythonSettings, workspaceRoot);
        return proxy.rename<RenameResponse>(document, newName, document.uri.fsPath, range).then(response => {
            const fileDiffs = response.results.map(fileChanges => fileChanges.diff);
            return getWorkspaceEditsFromPatch(fileDiffs, workspaceRoot);
        }).catch(reason => {
            if (reason === 'Not installed') {
                this.installer.promptToInstall(Product.rope, document.uri);
                return Promise.reject('');
            }
            else {
                vscode.window.showErrorMessage(reason);
                this.outputChannel.appendLine(reason);
            }
            return Promise.reject(reason);
        });
    }
}
