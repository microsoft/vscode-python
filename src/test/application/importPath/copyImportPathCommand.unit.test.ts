// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { expect } from 'chai';
import * as vscode from 'vscode';
import { CopyImportPathCommand } from '../../../client/application/importPath/copyImportPathCommand';
import { IClipboard, ICommandManager, IWorkspaceService } from '../../../client/common/application/types';
import * as pythonUtils from '../../../client/common/utils/pythonUtils';
import { ClipboardService } from '../../../client/common/application/clipboard';
import { CommandManager } from '../../../client/common/application/commandManager';
import { WorkspaceService } from '../../../client/common/application/workspace';

suite('Copy Import Path Command', () => {
    let command: CopyImportPathCommand;
    let commandManager: ICommandManager;
    let workspaceService: IWorkspaceService;
    let clipboard: IClipboard;
    let originalGetSysPath: () => string[];

    let clipboardText = '';

    setup(() => {
        commandManager = mock(CommandManager);
        workspaceService = mock(WorkspaceService);
        clipboard = mock(ClipboardService);
        command = new CopyImportPathCommand(instance(commandManager), instance(workspaceService), instance(clipboard));
        originalGetSysPath = pythonUtils.getSysPath;

        clipboardText = '';
        when(clipboard.writeText(anything())).thenCall(async (text: string) => {
            clipboardText = text;
        });
    });

    teardown(() => {
        ((pythonUtils as unknown) as { getSysPath: () => string[] }).getSysPath = originalGetSysPath;
    });

    test('Confirm command handler is added', async () => {
        await command.activate();
        verify(commandManager.registerCommand('python.copyImportPath', anything(), anything())).once();
    });

    test('execute() – sys.path match takes precedence', async () => {
        const absPath = '/home/user/project/src/pkg/module.py';
        const uri = vscode.Uri.file(absPath);
        ((pythonUtils as unknown) as { getSysPath: () => string[] }).getSysPath = () => ['/home/user/project/src'];

        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(undefined);
        ((vscode.window as unknown) as { activeTextEditor: { document: { uri: vscode.Uri } } }).activeTextEditor = {
            document: { uri },
        };

        await ((command as unknown) as { execute(u: vscode.Uri): Promise<void> }).execute(uri);
        expect(clipboardText).to.equal('pkg.module');
    });

    test('execute() – workspaceFolder used when no sys.path match', async () => {
        const absPath = '/home/user/project/tools/util.py';
        const uri = vscode.Uri.file(absPath);
        ((pythonUtils as unknown) as { getSysPath: () => string[] }).getSysPath = () => [];

        const wsFolder = {
            uri: vscode.Uri.file('/home/user/project'),
            name: 'project',
            index: 0,
        } as vscode.WorkspaceFolder;
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(wsFolder);

        ((vscode.window as unknown) as { activeTextEditor: { document: { uri: vscode.Uri } } }).activeTextEditor = {
            document: { uri },
        };
        await ((command as unknown) as { execute(u: vscode.Uri): Promise<void> }).execute(uri);
        expect(clipboardText).to.equal('tools.util');
    });

    test('execute() – falls back to filename when no matches', async () => {
        const absPath = '/tmp/standalone.py';
        const uri = vscode.Uri.file(absPath);
        ((pythonUtils as unknown) as { getSysPath: () => string[] }).getSysPath = () => [];
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(undefined);

        ((vscode.window as unknown) as { activeTextEditor: { document: { uri: vscode.Uri } } }).activeTextEditor = {
            document: { uri },
        };
        await ((command as unknown) as { execute(u: vscode.Uri): Promise<void> }).execute(uri);
        expect(clipboardText).to.equal('standalone');
    });
});
