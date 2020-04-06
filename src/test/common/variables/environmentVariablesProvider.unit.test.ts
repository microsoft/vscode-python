// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { ConfigurationChangeEvent, FileSystemWatcher, Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IPlatformService } from '../../../client/common/platform/types';
import { CurrentProcess } from '../../../client/common/process/currentProcess';
import { IConfigurationService, ICurrentProcess, IPythonSettings } from '../../../client/common/types';
import { clearCache } from '../../../client/common/utils/cacheUtils';
import { EnvironmentVariablesService } from '../../../client/common/variables/environment';
import { EnvironmentVariablesProvider } from '../../../client/common/variables/environmentVariablesProvider';
import { IEnvironmentVariablesService } from '../../../client/common/variables/types';
import { EnvFileTelemetry } from '../../../client/telemetry/envFileTelemetry';
import { noop } from '../../core';

// tslint:disable:no-any max-func-body-length
suite('Multiroot Environment Variables Provider', () => {
    let provider: EnvironmentVariablesProvider;
    let envVarsService: IEnvironmentVariablesService;
    let platform: IPlatformService;
    let workspace: IWorkspaceService;
    let configuration: IConfigurationService;
    let currentProcess: ICurrentProcess;
    let settings: IPythonSettings;

    setup(() => {
        envVarsService = mock(EnvironmentVariablesService);
        platform = mock(PlatformService);
        workspace = mock(WorkspaceService);
        configuration = mock(ConfigurationService);
        currentProcess = mock(CurrentProcess);
        settings = mock(PythonSettings);

        when(configuration.getSettings(anything())).thenReturn(instance(settings));
        when(workspace.onDidChangeConfiguration).thenReturn(noop as any);
        provider = new EnvironmentVariablesProvider(
            instance(envVarsService),
            [],
            instance(platform),
            instance(workspace),
            instance(configuration),
            instance(currentProcess)
        );

        sinon.stub(EnvFileTelemetry, 'sendFileCreationTelemetry').returns();

        clearCache();
    });

    teardown(() => {
        sinon.restore();
    });

    test('Event is fired when there are changes to settings', () => {
        let affectedWorkspace: Uri | undefined;
        const workspaceFolder1Uri = Uri.file('workspace1');
        const workspaceFolder2Uri = Uri.file('workspace2');

        provider.trackedWorkspaceFolders.add(workspaceFolder1Uri.fsPath);
        provider.trackedWorkspaceFolders.add(workspaceFolder2Uri.fsPath);
        provider.onDidEnvironmentVariablesChange((uri) => (affectedWorkspace = uri));
        const changedEvent: ConfigurationChangeEvent = {
            affectsConfiguration(setting: string, uri?: Uri) {
                return setting === 'python.envFile' && uri!.fsPath === workspaceFolder1Uri.fsPath;
            }
        };

        provider.configurationChanged(changedEvent);

        assert.ok(affectedWorkspace);
        assert.equal(affectedWorkspace!.fsPath, workspaceFolder1Uri.fsPath);
    });
    test('Event is not fired when there are not changes to settings', () => {
        let affectedWorkspace: Uri | undefined;
        const workspaceFolderUri = Uri.file('workspace1');

        provider.trackedWorkspaceFolders.add(workspaceFolderUri.fsPath);
        provider.onDidEnvironmentVariablesChange((uri) => (affectedWorkspace = uri));
        const changedEvent: ConfigurationChangeEvent = {
            affectsConfiguration(_setting: string, _uri?: Uri) {
                return false;
            }
        };

        provider.configurationChanged(changedEvent);

        assert.equal(affectedWorkspace, undefined);
    });
    test('Event is not fired when workspace is not tracked', () => {
        let affectedWorkspace: Uri | undefined;
        provider.onDidEnvironmentVariablesChange((uri) => (affectedWorkspace = uri));
        const changedEvent: ConfigurationChangeEvent = {
            affectsConfiguration(_setting: string, _uri?: Uri) {
                return true;
            }
        };

        provider.configurationChanged(changedEvent);

        assert.equal(affectedWorkspace, undefined);
    });
    [undefined, Uri.file('workspace')].forEach((workspaceUri) => {
        const workspaceTitle = workspaceUri ? '(with a workspace)' : '(without a workspace)';
        test(`Event is fired when the environment file is modified ${workspaceTitle}`, () => {
            let affectedWorkspace: Uri | undefined = Uri.file('dummy value');
            const envFile = path.join('a', 'b', 'env.file');
            const fileSystemWatcher = typemoq.Mock.ofType<FileSystemWatcher>();

            let onChangeHandler: undefined | ((resource?: Uri) => Function);

            fileSystemWatcher
                .setup((fs) => fs.onDidChange(typemoq.It.isAny()))
                .callback((cb) => (onChangeHandler = cb))
                .verifiable(typemoq.Times.once());
            when(workspace.createFileSystemWatcher(envFile)).thenReturn(fileSystemWatcher.object);
            provider.onDidEnvironmentVariablesChange((uri) => (affectedWorkspace = uri));

            provider.createFileWatcher(envFile, workspaceUri);

            fileSystemWatcher.verifyAll();
            assert.ok(onChangeHandler);

            onChangeHandler!();

            assert.equal(affectedWorkspace, workspaceUri);
        });
        test(`Event is fired when the environment file is deleted ${workspaceTitle}`, () => {
            let affectedWorkspace: Uri | undefined = Uri.file('dummy value');
            const envFile = path.join('a', 'b', 'env.file');
            const fileSystemWatcher = typemoq.Mock.ofType<FileSystemWatcher>();

            let onDeleted: undefined | ((resource?: Uri) => Function);

            fileSystemWatcher
                .setup((fs) => fs.onDidDelete(typemoq.It.isAny()))
                .callback((cb) => (onDeleted = cb))
                .verifiable(typemoq.Times.once());
            when(workspace.createFileSystemWatcher(envFile)).thenReturn(fileSystemWatcher.object);
            provider.onDidEnvironmentVariablesChange((uri) => (affectedWorkspace = uri));

            provider.createFileWatcher(envFile, workspaceUri);

            fileSystemWatcher.verifyAll();
            assert.ok(onDeleted);

            onDeleted!();

            assert.equal(affectedWorkspace, workspaceUri);
        });
        test(`Event is fired when the environment file is created ${workspaceTitle}`, () => {
            let affectedWorkspace: Uri | undefined = Uri.file('dummy value');
            const envFile = path.join('a', 'b', 'env.file');
            const fileSystemWatcher = typemoq.Mock.ofType<FileSystemWatcher>();

            let onCreated: undefined | ((resource?: Uri) => Function);

            fileSystemWatcher
                .setup((fs) => fs.onDidCreate(typemoq.It.isAny()))
                .callback((cb) => (onCreated = cb))
                .verifiable(typemoq.Times.once());
            when(workspace.createFileSystemWatcher(envFile)).thenReturn(fileSystemWatcher.object);
            provider.onDidEnvironmentVariablesChange((uri) => (affectedWorkspace = uri));

            provider.createFileWatcher(envFile, workspaceUri);

            fileSystemWatcher.verifyAll();
            assert.ok(onCreated);

            onCreated!();

            assert.equal(affectedWorkspace, workspaceUri);
        });
        test(`File system watcher event handlers are added once ${workspaceTitle}`, () => {
            const envFile = path.join('a', 'b', 'env.file');
            const fileSystemWatcher = typemoq.Mock.ofType<FileSystemWatcher>();

            fileSystemWatcher.setup((fs) => fs.onDidChange(typemoq.It.isAny())).verifiable(typemoq.Times.once());
            fileSystemWatcher.setup((fs) => fs.onDidCreate(typemoq.It.isAny())).verifiable(typemoq.Times.once());
            fileSystemWatcher.setup((fs) => fs.onDidDelete(typemoq.It.isAny())).verifiable(typemoq.Times.once());
            when(workspace.createFileSystemWatcher(envFile)).thenReturn(fileSystemWatcher.object);

            provider.createFileWatcher(envFile);
            provider.createFileWatcher(envFile);
            provider.createFileWatcher(envFile, workspaceUri);
            provider.createFileWatcher(envFile, workspaceUri);
            provider.createFileWatcher(envFile, workspaceUri);

            fileSystemWatcher.verifyAll();
            verify(workspace.createFileSystemWatcher(envFile)).once();
        });

        test(`Getting environment variables (without an envfile, without PATH in current env, without PYTHONPATH in current env) & ${workspaceTitle}`, async () => {
            const envFile = path.join('a', 'b', 'env.file');
            const workspaceFolder = workspaceUri ? { name: '', index: 0, uri: workspaceUri } : undefined;
            const currentProcEnv = { SOMETHING: 'wow' };

            when(currentProcess.env).thenReturn(currentProcEnv);
            when(settings.envFile).thenReturn(envFile);
            when(workspace.getWorkspaceFolder(workspaceUri)).thenReturn(workspaceFolder);
            when(envVarsService.parseFile(envFile, currentProcEnv)).thenResolve(undefined);
            when(platform.pathVariableName).thenReturn('PATH');

            const vars = await provider.getEnvironmentVariables(workspaceUri);

            verify(currentProcess.env).atLeast(1);
            verify(settings.envFile).atLeast(1);
            verify(envVarsService.parseFile(envFile, currentProcEnv)).atLeast(1);
            verify(envVarsService.mergeVariables(deepEqual(currentProcEnv), deepEqual({}))).once();
            verify(platform.pathVariableName).atLeast(1);
            assert.deepEqual(vars, {});
        });
        test(`Getting environment variables (with an envfile, without PATH in current env, without PYTHONPATH in current env) & ${workspaceTitle}`, async () => {
            const envFile = path.join('a', 'b', 'env.file');
            const workspaceFolder = workspaceUri ? { name: '', index: 0, uri: workspaceUri } : undefined;
            const currentProcEnv = { SOMETHING: 'wow' };
            const envFileVars = { MY_FILE: '1234' };

            when(currentProcess.env).thenReturn(currentProcEnv);
            when(settings.envFile).thenReturn(envFile);
            when(workspace.getWorkspaceFolder(workspaceUri)).thenReturn(workspaceFolder);
            when(envVarsService.parseFile(envFile, currentProcEnv)).thenResolve(envFileVars);
            when(platform.pathVariableName).thenReturn('PATH');

            const vars = await provider.getEnvironmentVariables(workspaceUri);

            verify(currentProcess.env).atLeast(1);
            verify(settings.envFile).atLeast(1);
            verify(envVarsService.parseFile(envFile, currentProcEnv)).atLeast(1);
            verify(envVarsService.mergeVariables(deepEqual(currentProcEnv), deepEqual(envFileVars))).once();
            verify(platform.pathVariableName).atLeast(1);
            assert.deepEqual(vars, envFileVars);
        });
        test(`Getting environment variables (with an envfile, with PATH in current env, with PYTHONPATH in current env) & ${workspaceTitle}`, async () => {
            const envFile = path.join('a', 'b', 'env.file');
            const workspaceFolder = workspaceUri ? { name: '', index: 0, uri: workspaceUri } : undefined;
            const currentProcEnv = { SOMETHING: 'wow', PATH: 'some path value', PYTHONPATH: 'some python path value' };
            const envFileVars = { MY_FILE: '1234' };

            when(currentProcess.env).thenReturn(currentProcEnv);
            when(settings.envFile).thenReturn(envFile);
            when(workspace.getWorkspaceFolder(workspaceUri)).thenReturn(workspaceFolder);
            when(envVarsService.parseFile(envFile, currentProcEnv)).thenResolve(envFileVars);
            when(platform.pathVariableName).thenReturn('PATH');

            const vars = await provider.getEnvironmentVariables(workspaceUri);

            verify(currentProcess.env).atLeast(1);
            verify(settings.envFile).atLeast(1);
            verify(envVarsService.parseFile(envFile, currentProcEnv)).atLeast(1);
            verify(envVarsService.mergeVariables(deepEqual(currentProcEnv), deepEqual(envFileVars))).once();
            verify(envVarsService.appendPath(deepEqual(envFileVars), currentProcEnv.PATH)).once();
            verify(envVarsService.appendPythonPath(deepEqual(envFileVars), currentProcEnv.PYTHONPATH)).once();
            verify(platform.pathVariableName).atLeast(1);
            assert.deepEqual(vars, envFileVars);
        });
    });
});
