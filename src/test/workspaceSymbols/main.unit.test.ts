// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { anyString, anything, instance, mock, reset, verify, when } from 'ts-mockito';
import { EventEmitter, TextDocument, Uri, WorkspaceFolder } from 'vscode';
import { ApplicationShell } from '../../client/common/application/applicationShell';
import { CommandManager } from '../../client/common/application/commandManager';
import { DocumentManager } from '../../client/common/application/documentManager';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWorkspaceService,
} from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { ConfigurationService } from '../../client/common/configuration/service';
import { Commands, STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { IFileSystem } from '../../client/common/platform/types';
import { ProcessService } from '../../client/common/process/proc';
import { ProcessServiceFactory } from '../../client/common/process/processFactory';
import { IProcessService, IProcessServiceFactory, Output } from '../../client/common/process/types';
import { IConfigurationService, IOutputChannel } from '../../client/common/types';
import { sleep } from '../../client/common/utils/async';
import { ServiceContainer } from '../../client/ioc/container';
import { IServiceContainer } from '../../client/ioc/types';
import { WorkspaceSymbols } from '../../client/workspaceSymbols/main';
import { MockOutputChannel } from '../mockClasses';

use(chaiAsPromised);

// tslint:disable: no-any
// tslint:disable-next-line: max-func-body-length
suite('Workspace symbols main', () => {
    const mockDisposable = {
        dispose: () => {
            return;
        },
    };
    const ctagsPath = 'CTAG_PATH';
    const observable = {
        out: {
            subscribe: (cb: (out: Output<string>) => void, _errorCb: any, done: Function) => {
                cb({ source: 'stdout', out: '' });
                done();
            },
        },
    };

    let outputChannel: IOutputChannel;
    let commandManager: ICommandManager;
    let fileSystem: IFileSystem;
    let workspaceService: IWorkspaceService;
    let processServiceFactory: IProcessServiceFactory;
    let processService: IProcessService;
    let applicationShell: IApplicationShell;
    let configurationService: IConfigurationService;
    let documentManager: IDocumentManager;
    let serviceContainer: IServiceContainer;
    let workspaceFolders: WorkspaceFolder[];
    let workspaceSymbols: WorkspaceSymbols;
    let shellOutput: string;
    let eventEmitter: EventEmitter<TextDocument>;

    setup(() => {
        eventEmitter = new EventEmitter<TextDocument>();
        shellOutput = '';
        workspaceFolders = [{ name: 'root', index: 0, uri: Uri.file('folder') }];

        outputChannel = mock(MockOutputChannel);
        commandManager = mock(CommandManager);
        fileSystem = mock(FileSystem);
        workspaceService = mock(WorkspaceService);
        processServiceFactory = mock(ProcessServiceFactory);
        processService = mock(ProcessService);
        applicationShell = mock(ApplicationShell);
        configurationService = mock(ConfigurationService);
        documentManager = mock(DocumentManager);
        serviceContainer = mock(ServiceContainer);

        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(() => mockDisposable as any);
        when(documentManager.onDidSaveTextDocument).thenReturn(eventEmitter.event);
        when(commandManager.registerCommand(anything(), anything())).thenReturn(mockDisposable as any);
        when(fileSystem.directoryExists(anything())).thenResolve(true);
        when(fileSystem.fileExists(anything())).thenResolve(false);
        when(processServiceFactory.create()).thenResolve(instance(processService));
        when(processService.execObservable(ctagsPath, anything(), anything())).thenReturn(observable as any);
        when(applicationShell.setStatusBarMessage(anyString(), anything())).thenCall((text: string) => {
            shellOutput += text;
            return mockDisposable;
        });

        when(serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL)).thenReturn(
            instance(outputChannel),
        );
        when(serviceContainer.get<ICommandManager>(ICommandManager)).thenReturn(instance(commandManager));
        when(serviceContainer.get<IFileSystem>(IFileSystem)).thenReturn(instance(fileSystem));
        when(serviceContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspaceService));
        when(serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory)).thenReturn(
            instance(processServiceFactory),
        );
        when(serviceContainer.get<IApplicationShell>(IApplicationShell)).thenReturn(instance(applicationShell));
        when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(
            instance(configurationService),
        );
        when(serviceContainer.get<IDocumentManager>(IDocumentManager)).thenReturn(instance(documentManager));
    });

    teardown(() => {
        workspaceSymbols.dispose();
    });

    test('Should not rebuild on start if the setting is disabled', () => {
        when(workspaceService.workspaceFolders).thenReturn(workspaceFolders);
        when(configurationService.getSettings(anything())).thenReturn({
            workspaceSymbols: { rebuildOnStart: false },
        } as any);

        workspaceSymbols = new WorkspaceSymbols(instance(serviceContainer));

        assert.equal(shellOutput, '');
    });

    test("Should not rebuild on start if we don't have a workspace folder", () => {
        when(workspaceService.workspaceFolders).thenReturn([]);
        when(configurationService.getSettings(anything())).thenReturn({
            workspaceSymbols: { rebuildOnStart: false },
        } as any);

        workspaceSymbols = new WorkspaceSymbols(instance(serviceContainer));

        assert.equal(shellOutput, '');
    });

    test('Should rebuild on start if the setting is enabled and we have a workspace folder', async () => {
        when(workspaceService.workspaceFolders).thenReturn(workspaceFolders);
        when(configurationService.getSettings(anything())).thenReturn({
            workspaceSymbols: {
                ctagsPath,
                enabled: true,
                exclusionPatterns: [],
                rebuildOnStart: true,
                tagFilePath: 'foo',
            },
        } as any);

        workspaceSymbols = new WorkspaceSymbols(instance(serviceContainer));
        await sleep(1);

        assert.equal(shellOutput, 'Generating Tags');
    });

    test('Should rebuild on save if the setting is enabled', async () => {
        when(workspaceService.workspaceFolders).thenReturn(workspaceFolders);
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(workspaceFolders[0]);
        when(configurationService.getSettings(anything())).thenReturn({
            workspaceSymbols: {
                ctagsPath,
                enabled: true,
                exclusionPatterns: [],
                rebuildOnFileSave: true,
                tagFilePath: 'foo',
            },
        } as any);

        workspaceSymbols = new WorkspaceSymbols(instance(serviceContainer));
        eventEmitter.fire({ uri: Uri.file('folder') } as any);
        await sleep(1);

        assert.equal(shellOutput, 'Generating Tags');
    });

    test('Command `Build Workspace symbols` is registered with the correct callback handlers and executing it returns `undefined` list if generating workspace tags fails with error', async () => {
        let buildWorkspaceSymbolsHandler!: Function;
        when(workspaceService.workspaceFolders).thenReturn(workspaceFolders);
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(workspaceFolders[0]);
        when(configurationService.getSettings(anything())).thenReturn({
            workspaceSymbols: {
                ctagsPath,
                enabled: true,
                exclusionPatterns: [],
                rebuildOnFileSave: true,
                tagFilePath: 'foo',
            },
        } as any);
        reset(commandManager);
        when(commandManager.registerCommand(anything(), anything())).thenCall((commandID, cb) => {
            expect(commandID).to.equal(Commands.Build_Workspace_Symbols);
            buildWorkspaceSymbolsHandler = cb;
            return mockDisposable;
        });
        reset(applicationShell);
        when(applicationShell.setStatusBarMessage(anyString(), anything())).thenThrow(
            new Error('Generating workspace tags failed with Error'),
        );

        workspaceSymbols = new WorkspaceSymbols(instance(serviceContainer));
        expect(buildWorkspaceSymbolsHandler).to.not.equal(undefined, 'Handler not registered');
        const symbols = await buildWorkspaceSymbolsHandler();

        verify(commandManager.registerCommand(anything(), anything())).once();
        assert.deepEqual(symbols, [undefined]);
    });

    test('Should not rebuild on save if the setting is disabled', () => {
        when(workspaceService.workspaceFolders).thenReturn(workspaceFolders);
        when(configurationService.getSettings(anything())).thenReturn({
            workspaceSymbols: {
                ctagsPath,
                enabled: true,
                exclusionPatterns: [],
                rebuildOnFileSave: false,
                tagFilePath: 'foo',
            },
        } as any);

        workspaceSymbols = new WorkspaceSymbols(instance(serviceContainer));

        assert.equal(shellOutput, '');
    });
});
