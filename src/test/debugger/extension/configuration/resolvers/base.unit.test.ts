/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { DebugConfiguration, Uri, WorkspaceFolder } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { ConfigurationService } from '../../../../../client/common/configuration/service';
import { IConfigurationService } from '../../../../../client/common/types';
import { BaseConfigurationResolver } from '../../../../../client/debugger/extension/configuration/resolvers/base';
import { AttachRequestArguments, DebugOptions, LaunchRequestArguments } from '../../../../../client/debugger/types';
import { IInterpreterService } from '../../../../../client/interpreter/contracts';
import { PythonEnvironment } from '../../../../../client/pythonEnvironments/info';
import * as workspaceApis from '../../../../../client/common/vscodeApis/workspaceApis';
import * as helper from '../../../../../client/debugger/extension/configuration/resolvers/helper';

suite('Debugging - Config Resolver', () => {
    class BaseResolver extends BaseConfigurationResolver<AttachRequestArguments | LaunchRequestArguments> {
        public resolveDebugConfiguration(
            _folder: WorkspaceFolder | undefined,
            _debugConfiguration: DebugConfiguration,
            _token?: CancellationToken,
        ): Promise<AttachRequestArguments | LaunchRequestArguments | undefined> {
            throw new Error('Not Implemented');
        }

        public resolveDebugConfigurationWithSubstitutedVariables(
            _folder: WorkspaceFolder | undefined,
            _debugConfiguration: DebugConfiguration,
            _token?: CancellationToken,
        ): Promise<AttachRequestArguments | LaunchRequestArguments | undefined> {
            throw new Error('Not Implemented');
        }

        public getWorkspaceFolder(folder: WorkspaceFolder | undefined): Uri | undefined {
            return BaseConfigurationResolver.getWorkspaceFolder(folder);
        }

        public resolveAndUpdatePythonPath(
            workspaceFolderUri: Uri | undefined,
            debugConfiguration: LaunchRequestArguments,
        ) {
            return super.resolveAndUpdatePythonPath(workspaceFolderUri, debugConfiguration);
        }

        public debugOption(debugOptions: DebugOptions[], debugOption: DebugOptions) {
            return BaseConfigurationResolver.debugOption(debugOptions, debugOption);
        }

        public isLocalHost(hostName?: string) {
            return BaseConfigurationResolver.isLocalHost(hostName);
        }

        public isDebuggingFastAPI(debugConfiguration: Partial<LaunchRequestArguments & AttachRequestArguments>) {
            return BaseConfigurationResolver.isDebuggingFastAPI(debugConfiguration);
        }

        public isDebuggingFlask(debugConfiguration: Partial<LaunchRequestArguments & AttachRequestArguments>) {
            return BaseConfigurationResolver.isDebuggingFlask(debugConfiguration);
        }
    }
    let resolver: BaseResolver;
    let configurationService: IConfigurationService;
    let interpreterService: IInterpreterService;
    let getWorkspaceFoldersStub: sinon.SinonStub;
    let getWorkspaceFolderStub: sinon.SinonStub;
    let getProgramStub: sinon.SinonStub;

    setup(() => {
        configurationService = mock(ConfigurationService);
        interpreterService = mock<IInterpreterService>();
        resolver = new BaseResolver(instance(configurationService), instance(interpreterService));
        getWorkspaceFoldersStub = sinon.stub(workspaceApis, 'getWorkspaceFolders');
        getWorkspaceFolderStub = sinon.stub(workspaceApis, 'getWorkspaceFolder');
        getProgramStub = sinon.stub(helper, 'getProgram');
    });
    teardown(() => {
        sinon.restore();
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
            workspaceFolders: undefined,
        },
        { title: 'Should get directory of active program when there are 0 workspace folders', workspaceFolders: [] },
    ].forEach((item) => {
        test(item.title, () => {
            const programPath = path.join('one', 'two', 'three.xyz');

            getProgramStub.returns(programPath);
            getWorkspaceFoldersStub.returns(item.workspaceFolders);

            const uri = resolver.getWorkspaceFolder(undefined);

            expect(uri!.fsPath).to.be.deep.equal(Uri.file(path.dirname(programPath)).fsPath);
        });
    });
    test('Should return uri of workspace folder if there is only one workspace folder', () => {
        const expectedUri = Uri.parse('mock');
        const folder: WorkspaceFolder = { index: 0, uri: expectedUri, name: 'mock' };
        const folders: WorkspaceFolder[] = [folder];

        getProgramStub.returns(undefined);

        getWorkspaceFolderStub.returns(folder);

        getWorkspaceFoldersStub.returns(folders);

        const uri = resolver.getWorkspaceFolder(undefined);

        expect(uri!.fsPath).to.be.deep.equal(expectedUri.fsPath);
    });
    test('Should return uri of workspace folder corresponding to program if there is more than one workspace folder', () => {
        const programPath = path.join('one', 'two', 'three.xyz');
        const folder1: WorkspaceFolder = { index: 0, uri: Uri.parse('mock'), name: 'mock' };
        const folder2: WorkspaceFolder = { index: 1, uri: Uri.parse('134'), name: 'mock2' };
        const folders: WorkspaceFolder[] = [folder1, folder2];

        getProgramStub.returns(programPath);

        getWorkspaceFoldersStub.returns(folders);

        getWorkspaceFolderStub.returns(folder2);

        const uri = resolver.getWorkspaceFolder(undefined);

        expect(uri!.fsPath).to.be.deep.equal(folder2.uri.fsPath);
    });
    test('Should return undefined when program does not belong to any of the workspace folders', () => {
        const programPath = path.join('one', 'two', 'three.xyz');
        const folder1: WorkspaceFolder = { index: 0, uri: Uri.parse('mock'), name: 'mock' };
        const folder2: WorkspaceFolder = { index: 1, uri: Uri.parse('134'), name: 'mock2' };
        const folders: WorkspaceFolder[] = [folder1, folder2];

        getProgramStub.returns(programPath);
        getWorkspaceFoldersStub.returns(folders);

        getWorkspaceFolderStub.returns(undefined);

        const uri = resolver.getWorkspaceFolder(undefined);

        expect(uri).to.be.deep.equal(undefined, 'not undefined');
    });
    test('Do nothing if debug configuration is undefined', async () => {
        await resolver.resolveAndUpdatePythonPath(undefined, (undefined as unknown) as LaunchRequestArguments);
    });
    test('pythonPath in debug config must point to pythonPath in settings if pythonPath in config is not set', async () => {
        const config = {};
        const pythonPath = path.join('1', '2', '3');

        when(interpreterService.getActiveInterpreter(anything())).thenResolve({
            path: pythonPath,
        } as PythonEnvironment);

        await resolver.resolveAndUpdatePythonPath(undefined, config as LaunchRequestArguments);

        expect(config).to.have.property('pythonPath', pythonPath);
    });
    test('pythonPath in debug config must point to pythonPath in settings  if pythonPath in config is ${command:python.interpreterPath}', async () => {
        const config = {
            pythonPath: '${command:python.interpreterPath}',
        };
        const pythonPath = path.join('1', '2', '3');

        when(interpreterService.getActiveInterpreter(anything())).thenResolve({
            path: pythonPath,
        } as PythonEnvironment);

        await resolver.resolveAndUpdatePythonPath(undefined, config as LaunchRequestArguments);

        expect(config.pythonPath).to.equal(pythonPath);
    });
    const localHostTestMatrix: Record<string, boolean> = {
        localhost: true,
        '127.0.0.1': true,
        '::1': true,
        '127.0.0.2': false,
        '156.1.2.3': false,
        '::2': false,
    };
    Object.keys(localHostTestMatrix).forEach((key) => {
        test(`Local host = ${localHostTestMatrix[key]} for ${key}`, () => {
            const isLocalHost = resolver.isLocalHost(key);

            expect(isLocalHost).to.equal(localHostTestMatrix[key]);
        });
    });
    test('Is debugging fastapi=true', () => {
        const config = { module: 'fastapi' };
        const isFastAPI = resolver.isDebuggingFastAPI(config as LaunchRequestArguments);
        expect(isFastAPI).to.equal(true, 'not fastapi');
    });
    test('Is debugging fastapi=false', () => {
        const config = { module: 'fastapi2' };
        const isFastAPI = resolver.isDebuggingFastAPI(config as LaunchRequestArguments);
        expect(isFastAPI).to.equal(false, 'fastapi');
    });
    test('Is debugging fastapi=false when not defined', () => {
        const config = {};
        const isFastAPI = resolver.isDebuggingFastAPI(config as LaunchRequestArguments);
        expect(isFastAPI).to.equal(false, 'fastapi');
    });
    test('Is debugging flask=true', () => {
        const config = { module: 'flask' };
        const isFlask = resolver.isDebuggingFlask(config as LaunchRequestArguments);
        expect(isFlask).to.equal(true, 'not flask');
    });
    test('Is debugging flask=false', () => {
        const config = { module: 'flask2' };
        const isFlask = resolver.isDebuggingFlask(config as LaunchRequestArguments);
        expect(isFlask).to.equal(false, 'flask');
    });
    test('Is debugging flask=false when not defined', () => {
        const config = {};
        const isFlask = resolver.isDebuggingFlask(config as LaunchRequestArguments);
        expect(isFlask).to.equal(false, 'flask');
    });
});
