// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as sinon from 'sinon';
import { assert, expect } from 'chai';
import { cloneDeep } from 'lodash';
import { mock, instance, when, anything, verify, reset } from 'ts-mockito';
import { EnvironmentVariableCollection, ProgressLocation, Uri, WorkspaceFolder } from 'vscode';
import {
    IApplicationShell,
    IApplicationEnvironment,
    IWorkspaceService,
} from '../../../client/common/application/types';
import { TerminalEnvVarActivation } from '../../../client/common/experiments/groups';
import { IPlatformService } from '../../../client/common/platform/types';
import {
    IExtensionContext,
    IExperimentService,
    Resource,
    IConfigurationService,
    IPythonSettings,
} from '../../../client/common/types';
import { Interpreters } from '../../../client/common/utils/localize';
import { OSType, getOSType } from '../../../client/common/utils/platform';
import { defaultShells } from '../../../client/interpreter/activation/service';
import {
    TerminalEnvVarCollectionService,
    _normCaseKeys,
} from '../../../client/interpreter/activation/terminalEnvVarCollectionService';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { PathUtils } from '../../../client/common/platform/pathUtils';

suite('Terminal Environment Variable Collection Service', () => {
    let platform: IPlatformService;
    let interpreterService: IInterpreterService;
    let context: IExtensionContext;
    let shell: IApplicationShell;
    let experimentService: IExperimentService;
    let collection: EnvironmentVariableCollection;
    let applicationEnvironment: IApplicationEnvironment;
    let environmentActivationService: IEnvironmentActivationService;
    let workspaceService: IWorkspaceService;
    let terminalEnvVarCollectionService: TerminalEnvVarCollectionService;
    const progressOptions = {
        location: ProgressLocation.Window,
        title: Interpreters.activatingTerminals,
    };
    let configService: IConfigurationService;
    const displayPath = 'display/path';
    const customShell = 'powershell';
    const defaultShell = defaultShells[getOSType()];

    setup(() => {
        workspaceService = mock<IWorkspaceService>();
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(undefined);
        when(workspaceService.workspaceFolders).thenReturn(undefined);
        platform = mock<IPlatformService>();
        when(platform.osType).thenReturn(getOSType());
        interpreterService = mock<IInterpreterService>();
        context = mock<IExtensionContext>();
        shell = mock<IApplicationShell>();
        collection = mock<EnvironmentVariableCollection>();
        when(context.environmentVariableCollection).thenReturn(instance(collection));
        experimentService = mock<IExperimentService>();
        when(experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)).thenReturn(true);
        applicationEnvironment = mock<IApplicationEnvironment>();
        when(applicationEnvironment.shell).thenReturn(customShell);
        when(shell.withProgress(anything(), anything()))
            .thenCall((options, _) => {
                expect(options).to.deep.equal(progressOptions);
            })
            .thenResolve();
        environmentActivationService = mock<IEnvironmentActivationService>();
        configService = mock<IConfigurationService>();
        when(configService.getSettings(anything())).thenReturn(({
            terminal: { activateEnvironment: true },
            pythonPath: displayPath,
        } as unknown) as IPythonSettings);
        terminalEnvVarCollectionService = new TerminalEnvVarCollectionService(
            instance(platform),
            instance(interpreterService),
            instance(context),
            instance(shell),
            instance(experimentService),
            instance(applicationEnvironment),
            [],
            instance(environmentActivationService),
            instance(workspaceService),
            instance(configService),
            new PathUtils(getOSType() === OSType.Windows),
        );
    });

    teardown(() => {
        sinon.restore();
    });

    test('Apply activated variables to the collection on activation', async () => {
        const applyCollectionStub = sinon.stub(terminalEnvVarCollectionService, '_applyCollection');
        applyCollectionStub.resolves();
        when(interpreterService.onDidChangeInterpreter(anything(), anything(), anything())).thenReturn();
        when(applicationEnvironment.onDidChangeShell(anything(), anything(), anything())).thenReturn();
        await terminalEnvVarCollectionService.activate(undefined);
        assert(applyCollectionStub.calledOnce, 'Collection not applied on activation');
    });

    test('When not in experiment, do not apply activated variables to the collection and clear it instead', async () => {
        reset(experimentService);
        when(experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)).thenReturn(false);
        const applyCollectionStub = sinon.stub(terminalEnvVarCollectionService, '_applyCollection');
        applyCollectionStub.resolves();
        when(interpreterService.onDidChangeInterpreter(anything(), anything(), anything())).thenReturn();
        when(applicationEnvironment.onDidChangeShell(anything(), anything(), anything())).thenReturn();

        await terminalEnvVarCollectionService.activate(undefined);

        verify(interpreterService.onDidChangeInterpreter(anything(), anything(), anything())).once();
        verify(applicationEnvironment.onDidChangeShell(anything(), anything(), anything())).never();
        assert(applyCollectionStub.notCalled, 'Collection should not be applied on activation');

        verify(collection.clear()).atLeast(1);
    });

    test('When interpreter changes, apply new activated variables to the collection', async () => {
        const applyCollectionStub = sinon.stub(terminalEnvVarCollectionService, '_applyCollection');
        applyCollectionStub.resolves();
        const resource = Uri.file('x');
        let callback: (resource: Resource) => Promise<void>;
        when(interpreterService.onDidChangeInterpreter(anything(), anything(), anything())).thenCall((cb) => {
            callback = cb;
        });
        when(applicationEnvironment.onDidChangeShell(anything(), anything(), anything())).thenReturn();
        await terminalEnvVarCollectionService.activate(undefined);

        await callback!(resource);
        assert(applyCollectionStub.calledWithExactly(resource));
    });

    test('When selected shell changes, apply new activated variables to the collection', async () => {
        const applyCollectionStub = sinon.stub(terminalEnvVarCollectionService, '_applyCollection');
        applyCollectionStub.resolves();
        let callback: (shell: string) => Promise<void>;
        when(applicationEnvironment.onDidChangeShell(anything(), anything(), anything())).thenCall((cb) => {
            callback = cb;
        });
        when(interpreterService.onDidChangeInterpreter(anything(), anything(), anything())).thenReturn();
        await terminalEnvVarCollectionService.activate(undefined);

        await callback!(customShell);
        assert(applyCollectionStub.calledWithExactly(undefined, customShell));
    });

    test('If activated variables are returned for custom shell, apply it correctly to the collection', async () => {
        const envVars: NodeJS.ProcessEnv = { CONDA_PREFIX: 'prefix/to/conda', ..._normCaseKeys(process.env) };
        delete envVars.PATH;
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                customShell,
            ),
        ).thenResolve(envVars);

        when(collection.replace(anything(), anything(), anything())).thenResolve();
        when(collection.delete(anything(), anything())).thenResolve();

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda', anything())).once();
        verify(collection.delete('PATH', anything())).once();
    });

    test('Verify envs are not applied if env activation is disabled', async () => {
        const envVars: NodeJS.ProcessEnv = { CONDA_PREFIX: 'prefix/to/conda', ..._normCaseKeys(process.env) };
        delete envVars.PATH;
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                customShell,
            ),
        ).thenResolve(envVars);

        when(collection.replace(anything(), anything(), anything())).thenResolve();
        when(collection.delete(anything(), anything())).thenResolve();
        reset(configService);
        when(configService.getSettings(anything())).thenReturn(({
            terminal: { activateEnvironment: false },
            pythonPath: displayPath,
        } as unknown) as IPythonSettings);

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda', anything())).never();
        verify(collection.delete('PATH', anything())).never();
    });

    test('Verify correct scope is used when applying envs and setting description', async () => {
        const envVars: NodeJS.ProcessEnv = { CONDA_PREFIX: 'prefix/to/conda', ..._normCaseKeys(process.env) };
        delete envVars.PATH;
        const resource = Uri.file('a');
        const workspaceFolder: WorkspaceFolder = {
            uri: Uri.file('workspacePath'),
            name: 'workspace1',
            index: 0,
        };
        when(workspaceService.getWorkspaceFolder(resource)).thenReturn(workspaceFolder);
        when(
            environmentActivationService.getActivatedEnvironmentVariables(resource, undefined, undefined, customShell),
        ).thenResolve(envVars);

        when(collection.replace(anything(), anything(), anything())).thenCall((_e, _v, scope) => {
            assert.deepEqual(scope, { workspaceFolder });
            return Promise.resolve();
        });
        when(collection.delete(anything(), anything())).thenCall((_e, scope) => {
            assert.deepEqual(scope, { workspaceFolder });
            return Promise.resolve();
        });
        let description = '';
        when(collection.setDescription(anything(), anything())).thenCall((d, scope) => {
            assert.deepEqual(scope, { workspaceFolder });
            description = d.value;
        });

        await terminalEnvVarCollectionService._applyCollection(resource, customShell);

        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda', anything())).once();
        verify(collection.delete('PATH', anything())).once();
        expect(description).to.equal(`${Interpreters.activateTerminalDescription} \`${displayPath}\``);
    });

    test('Only relative changes to previously applied variables are applied to the collection', async () => {
        const envVars: NodeJS.ProcessEnv = {
            RANDOM_VAR: 'random',
            CONDA_PREFIX: 'prefix/to/conda',
            ..._normCaseKeys(process.env),
        };
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                customShell,
            ),
        ).thenResolve(envVars);

        when(collection.replace(anything(), anything(), anything())).thenResolve();
        when(collection.delete(anything(), anything())).thenResolve();

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        const newEnvVars = cloneDeep(envVars);
        delete newEnvVars.CONDA_PREFIX;
        newEnvVars.RANDOM_VAR = undefined; // Deleting the variable from the collection is the same as setting it to undefined.
        reset(environmentActivationService);
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                customShell,
            ),
        ).thenResolve(newEnvVars);

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        verify(collection.delete('CONDA_PREFIX', anything())).once();
        verify(collection.delete('RANDOM_VAR', anything())).once();
    });

    test('If no activated variables are returned for custom shell, fallback to using default shell', async () => {
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                customShell,
            ),
        ).thenResolve(undefined);
        const envVars = { CONDA_PREFIX: 'prefix/to/conda', ..._normCaseKeys(process.env) };
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                defaultShell?.shell,
            ),
        ).thenResolve(envVars);

        when(collection.replace(anything(), anything(), anything())).thenResolve();
        when(collection.delete(anything(), anything())).thenResolve();

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda', anything())).once();
        verify(collection.delete(anything(), anything())).never();
    });

    test('If no activated variables are returned for default shell, clear collection', async () => {
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                defaultShell?.shell,
            ),
        ).thenResolve(undefined);

        when(collection.replace(anything(), anything(), anything())).thenResolve();
        when(collection.delete(anything(), anything())).thenResolve();
        when(collection.setDescription(anything(), anything())).thenReturn();

        await terminalEnvVarCollectionService._applyCollection(undefined, defaultShell?.shell);

        verify(collection.clear(anything())).once();
        verify(collection.setDescription(anything(), anything())).never();
    });
});
