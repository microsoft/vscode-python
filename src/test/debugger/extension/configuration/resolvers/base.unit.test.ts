// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unnecessary-override no-invalid-template-strings max-func-body-length no-any

import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { DebugConfiguration, TextDocument, TextEditor, Uri, WorkspaceFolder } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { DocumentManager } from '../../../../../client/common/application/documentManager';
import { IDocumentManager, IWorkspaceService } from '../../../../../client/common/application/types';
import { WorkspaceService } from '../../../../../client/common/application/workspace';
import { ConfigurationService } from '../../../../../client/common/configuration/service';
import { PYTHON_LANGUAGE } from '../../../../../client/common/constants';
import { PlatformService } from '../../../../../client/common/platform/platformService';
import { IPlatformService } from '../../../../../client/common/platform/types';
import { IConfigurationService } from '../../../../../client/common/types';
import { BaseConfigurationResolver } from '../../../../../client/debugger/extension/configuration/resolvers/base';
import { AttachRequestArguments, DebugOptions, LaunchRequestArguments } from '../../../../../client/debugger/types';

suite('Debugging - Config Resolver', () => {
    class BaseResolver extends BaseConfigurationResolver<AttachRequestArguments | LaunchRequestArguments> {
        public resolveDebugConfiguration(
            _folder: WorkspaceFolder | undefined,
            _debugConfiguration: DebugConfiguration,
            _token?: CancellationToken
        ): Promise<AttachRequestArguments | LaunchRequestArguments | undefined> {
            throw new Error('Not Implemented');
        }
        public getWorkspaceFolder(folder: WorkspaceFolder | undefined): Uri | undefined {
            return super.getWorkspaceFolder(folder);
        }
        public getProgram(): string | undefined {
            return super.getProgram();
        }
        public resolveAndUpdatePythonPath(
            workspaceFolder: Uri | undefined,
            debugConfiguration: LaunchRequestArguments
        ): void {
            return super.resolveAndUpdatePythonPath(workspaceFolder, debugConfiguration);
        }
        public debugOption(debugOptions: DebugOptions[], debugOption: DebugOptions) {
            return super.debugOption(debugOptions, debugOption);
        }
        public isLocalHost(hostName?: string) {
            return super.isLocalHost(hostName);
        }
        public isDebuggingFlask(debugConfiguration: Partial<LaunchRequestArguments & AttachRequestArguments>) {
            return super.isDebuggingFlask(debugConfiguration);
        }
    }
    let resolver: BaseResolver;
    let workspaceService: IWorkspaceService;
    let platformService: IPlatformService;
    let documentManager: IDocumentManager;
    let configurationService: IConfigurationService;
    setup(() => {
        workspaceService = mock(WorkspaceService);
        documentManager = mock(DocumentManager);
        platformService = mock(PlatformService);
        configurationService = mock(ConfigurationService);
        resolver = new BaseResolver(
            instance(workspaceService),
            instance(documentManager),
            instance(platformService),
            instance(configurationService)
        );
    });

    test('Program should return filepath of active editor if file is python', () => {
        const expectedFileName = 'my.py';
        const editor = typemoq.Mock.ofType<TextEditor>();
        const doc = typemoq.Mock.ofType<TextDocument>();

        editor
            .setup((e) => e.document)
            .returns(() => doc.object)
            .verifiable(typemoq.Times.once());
        doc.setup((d) => d.languageId)
            .returns(() => PYTHON_LANGUAGE)
            .verifiable(typemoq.Times.once());
        doc.setup((d) => d.fileName)
            .returns(() => expectedFileName)
            .verifiable(typemoq.Times.once());
        when(documentManager.activeTextEditor).thenReturn(editor.object);

        const program = resolver.getProgram();

        expect(program).to.be.equal(expectedFileName);
    });
    test('Program should return undefined if active file is not python', () => {
        const editor = typemoq.Mock.ofType<TextEditor>();
        const doc = typemoq.Mock.ofType<TextDocument>();

        editor
            .setup((e) => e.document)
            .returns(() => doc.object)
            .verifiable(typemoq.Times.once());
        doc.setup((d) => d.languageId)
            .returns(() => 'C#')
            .verifiable(typemoq.Times.once());
        when(documentManager.activeTextEditor).thenReturn(editor.object);

        const program = resolver.getProgram();

        expect(program).to.be.equal(undefined, 'Not undefined');
    });
    test('Program should return undefined if there is no active editor', () => {
        when(documentManager.activeTextEditor).thenReturn(undefined);

        const program = resolver.getProgram();

        expect(program).to.be.equal(undefined, 'Not undefined');
    });
    test('Should get workspace folder when workspace folder is provided', () => {
        const expectedUri = Uri.parse('mock');
        const folder: WorkspaceFolder = { index: 0, uri: expectedUri, name: 'mock' };

        const uri = resolver.getWorkspaceFolder(folder);

        expect(uri).to.be.deep.equal(expectedUri);
    });
    [
        {
            title: 'Should get directory of active program when there are not workspace folders',
            workspaceFolders: undefined
        },
        { title: 'Should get directory of active program when there are 0 workspace folders', workspaceFolders: [] }
    ].forEach((item) => {
        test(item.title, () => {
            const programPath = path.join('one', 'two', 'three.xyz');

            resolver.getProgram = () => programPath;
            when(workspaceService.workspaceFolders).thenReturn(item.workspaceFolders);

            const uri = resolver.getWorkspaceFolder(undefined);

            expect(uri!.fsPath).to.be.deep.equal(Uri.file(path.dirname(programPath)).fsPath);
        });
    });
    test('Should return uri of workspace folder if there is only one workspace folder', () => {
        const expectedUri = Uri.parse('mock');
        const folder: WorkspaceFolder = { index: 0, uri: expectedUri, name: 'mock' };
        const folders: WorkspaceFolder[] = [folder];

        resolver.getProgram = () => undefined;
        when(workspaceService.workspaceFolders).thenReturn(folders);

        const uri = resolver.getWorkspaceFolder(undefined);

        expect(uri!.fsPath).to.be.deep.equal(expectedUri.fsPath);
    });
    test('Should return uri of workspace folder corresponding to program if there is more than one workspace folder', () => {
        const programPath = path.join('one', 'two', 'three.xyz');
        const folder1: WorkspaceFolder = { index: 0, uri: Uri.parse('mock'), name: 'mock' };
        const folder2: WorkspaceFolder = { index: 1, uri: Uri.parse('134'), name: 'mock2' };
        const folders: WorkspaceFolder[] = [folder1, folder2];

        resolver.getProgram = () => programPath;
        when(workspaceService.workspaceFolders).thenReturn(folders);
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(folder2);

        const uri = resolver.getWorkspaceFolder(undefined);

        expect(uri!.fsPath).to.be.deep.equal(folder2.uri.fsPath);
    });
    test('Should return undefined when program does not belong to any of the workspace folders', () => {
        const programPath = path.join('one', 'two', 'three.xyz');
        const folder1: WorkspaceFolder = { index: 0, uri: Uri.parse('mock'), name: 'mock' };
        const folder2: WorkspaceFolder = { index: 1, uri: Uri.parse('134'), name: 'mock2' };
        const folders: WorkspaceFolder[] = [folder1, folder2];

        resolver.getProgram = () => programPath;
        when(workspaceService.workspaceFolders).thenReturn(folders);
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(undefined);

        const uri = resolver.getWorkspaceFolder(undefined);

        expect(uri).to.be.deep.equal(undefined, 'not undefined');
    });
    test('Do nothing if debug configuration is undefined', () => {
        resolver.resolveAndUpdatePythonPath(undefined, undefined as any);
    });
    test('Python path in debug config must point to pythonpath in settings if pythonPath in config is not set', () => {
        const config = {};
        const pythonPath = path.join('1', '2', '3');

        when(configurationService.getSettings(anything())).thenReturn({ pythonPath } as any);

        resolver.resolveAndUpdatePythonPath(undefined, config as any);

        expect(config).to.have.property('pythonPath', pythonPath);
    });
    test('Python path in debug config must point to pythonpath in settings  if pythonPath in config is ${config:python.interpreterPath}', () => {
        const config = {
            pythonPath: '${config:python.interpreterPath}'
        };
        const pythonPath = path.join('1', '2', '3');

        when(configurationService.getSettings(anything())).thenReturn({ pythonPath } as any);

        resolver.resolveAndUpdatePythonPath(undefined, config as any);

        expect(config.pythonPath).to.equal(pythonPath);
    });
    const localHostTestMatrix: Record<string, boolean> = {
        localhost: true,
        '127.0.0.1': true,
        '::1': true,
        '127.0.0.2': false,
        '156.1.2.3': false,
        '::2': false
    };
    Object.keys(localHostTestMatrix).forEach((key) => {
        test(`Local host = ${localHostTestMatrix[key]} for ${key}`, () => {
            const isLocalHost = resolver.isLocalHost(key);

            expect(isLocalHost).to.equal(localHostTestMatrix[key]);
        });
    });
    test('Is debugging flask=true', () => {
        const config = { module: 'flask' };
        const isFlask = resolver.isDebuggingFlask(config as any);
        expect(isFlask).to.equal(true, 'not flask');
    });
    test('Is debugging flask=false', () => {
        const config = { module: 'flask2' };
        const isFlask = resolver.isDebuggingFlask(config as any);
        expect(isFlask).to.equal(false, 'flask');
    });
    test('Is debugging flask=false when not defined', () => {
        const config = {};
        const isFlask = resolver.isDebuggingFlask(config as any);
        expect(isFlask).to.equal(false, 'flask');
    });
});
