// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { InvalidTestSettingDiagnosticsService, InvalidTestSettingsDiagnostic } from '../../../../client/application/diagnostics/checks/updateTestSettings';
import { DiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/factory';
import { IDiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/types';
import { DiagnosticCommandPromptHandlerService, MessageCommandPrompt } from '../../../../client/application/diagnostics/promptHandler';
import { IDiagnosticHandlerService } from '../../../../client/application/diagnostics/types';
import { ApplicationEnvironment } from '../../../../client/common/application/applicationEnvironment';
import { IApplicationEnvironment, IWorkspaceService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { IPersistentState } from '../../../../client/common/types';
import { Common, Diagnostics } from '../../../../client/common/utils/localize';
import { ServiceContainer } from '../../../../client/ioc/container';

// tslint:disable:max-func-body-length
suite('Application Diagnostics - Check Test Settings', () => {
    let diagnosticService: InvalidTestSettingDiagnosticsService;
    let fs: IFileSystem;
    let appEnv: IApplicationEnvironment;
    let storage: IPersistentState<string[]>;
    let commandFactory: IDiagnosticsCommandFactory;
    let workspace: IWorkspaceService;
    let messageService: IDiagnosticHandlerService<MessageCommandPrompt>;
    setup(() => {
        fs = mock(FileSystem);
        appEnv = mock(ApplicationEnvironment);
        storage = mock(PersistentState);
        commandFactory = mock(DiagnosticsCommandFactory);
        workspace = mock(WorkspaceService);
        messageService = mock(DiagnosticCommandPromptHandlerService);
        const serviceContainer = mock(ServiceContainer);
        const stateFactory = mock(PersistentStateFactory);

        when(stateFactory.createGlobalPersistentState('python.unitTest.Settings', anything())).thenReturn(instance(storage));

        diagnosticService = new InvalidTestSettingDiagnosticsService(instance(serviceContainer),
            instance(fs), instance(appEnv), instance(stateFactory),
            instance(messageService),
            instance(commandFactory), instance(workspace), []);
    });

    test('When handing diagnostics, the right messsage will be displayed', async () => {
        const diagnostic = new InvalidTestSettingsDiagnostic();

        await diagnosticService.onHandle([diagnostic]);

        verify(messageService.handle(diagnostic, anything())).once();

        const options = capture(messageService.handle).first();
        const prompts = options[1]!.commandPrompts;

        assert.equal(prompts.length, 3);
        assert.equal(prompts[0].prompt, Diagnostics.updateSettings());
        assert.equal(prompts[1].prompt, Common.noIWillDoItLater());
        assert.equal(prompts[2].prompt, Common.doNotShowAgain());
    });
    test('When there are no workspaces open, then return just the user settings file', async () => {
        when(workspace.hasWorkspaceFolders).thenReturn(false);
        when(appEnv.userSettingsFile).thenReturn('user.json');

        const files = await diagnosticService.getSettingsFiles();

        assert.deepEqual(files, ['user.json']);
    });
    test('When there are no workspaces open & no user file, then return an empty array', async () => {
        when(workspace.hasWorkspaceFolders).thenReturn(false);
        when(appEnv.userSettingsFile).thenReturn();

        const files = await diagnosticService.getSettingsFiles();

        assert.deepEqual(files, []);
    });
    test('When there are workspaces open, then return user settings file with the workspace files', async () => {
        when(workspace.hasWorkspaceFolders).thenReturn(true);
        when(workspace.workspaceFolders).thenReturn([
            { name: '1', uri: Uri.file('folder1'), index: 0 },
            { name: '2', uri: Uri.file('folder2'), index: 1 }
        ]);
        when(appEnv.userSettingsFile).thenReturn('user.json');

        const files = await diagnosticService.getSettingsFiles();

        assert.deepEqual(files, [
            path.join(Uri.file('folder1').fsPath, '.vscode', 'settings.json'),
            path.join(Uri.file('folder2').fsPath, '.vscode', 'settings.json'),
            'user.json'
        ]);
    });
    test('Get settings files that contain the old unitTest setting', async () => {
        const folder1 = Uri.file('folder1');
        const folder2 = Uri.file('folder2');
        when(workspace.hasWorkspaceFolders).thenReturn(true);
        when(workspace.workspaceFolders).thenReturn([
            { name: '1', uri: folder1, index: 0 },
            { name: '2', uri: folder2, index: 1 }
        ]);
        when(appEnv.userSettingsFile).thenReturn('user.json');
        when(fs.readFile('user.json')).thenResolve('{"python.unitTest.cwd":"blah"}');
        when(fs.readFile(path.join(folder1.fsPath, '.vscode', 'settings.json'))).thenResolve('{"python.testing.cwd":"blah"}');
        when(fs.readFile(path.join(folder2.fsPath, '.vscode', 'settings.json'))).thenResolve('{"python.unitTest.pytestArgs":[]}');
        when(storage.value).thenReturn([]);

        const files = await diagnosticService.getFilesToBeFixed();

        assert.deepEqual(files, [
            path.join(folder2.fsPath, '.vscode', 'settings.json'),
            'user.json'
        ]);
    });
    test('None of the settings file need to be fixed', async () => {
        const folder1 = Uri.file('folder1');
        const folder2 = Uri.file('folder2');
        when(workspace.hasWorkspaceFolders).thenReturn(true);
        when(workspace.workspaceFolders).thenReturn([
            { name: '1', uri: folder1, index: 0 },
            { name: '2', uri: folder2, index: 1 }
        ]);
        when(appEnv.userSettingsFile).thenReturn('user.json');
        when(fs.readFile('user.json')).thenResolve('{"python.testing.cwd":"blah"}');
        when(fs.readFile(path.join(folder1.fsPath, '.vscode', 'settings.json'))).thenResolve('{"python.testing.cwd":"blah"}');
        when(fs.readFile(path.join(folder2.fsPath, '.vscode', 'settings.json'))).thenResolve('{"python.testing.pytestArgs":[]}');
        when(storage.value).thenReturn([]);

        const files = await diagnosticService.getFilesToBeFixed();

        assert.deepEqual(files, []);
    });
    test('Updates to the settings file will replace unitTest with testing', async () => {
        when(fs.readFile('user.json')).thenResolve('{"python.unitTest.cwd":"blah"}');
        when(fs.writeFile('user.json', anything())).thenResolve();

        await diagnosticService.fixSettingInFile('user.json');

        verify(fs.writeFile('user.json', '{"python.testing.cwd":"blah"}')).once();
    });
});
