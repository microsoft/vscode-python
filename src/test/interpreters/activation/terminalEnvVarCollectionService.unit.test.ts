// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as sinon from 'sinon';
import { assert, expect } from 'chai';
import { mock, instance, when, anything, verify, reset } from 'ts-mockito';
import {
    EnvironmentVariableCollection,
    EnvironmentVariableMutatorOptions,
    EnvironmentVariableScope,
    ProgressLocation,
    Uri,
    WorkspaceFolder,
} from 'vscode';
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
import { TerminalEnvVarCollectionService } from '../../../client/interpreter/activation/terminalEnvVarCollectionService';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { PathUtils } from '../../../client/common/platform/pathUtils';

suite('Terminal Environment Variable Collection Service', () => {
    let platform: IPlatformService;
    let interpreterService: IInterpreterService;
    let context: IExtensionContext;
    let shell: IApplicationShell;
    let experimentService: IExperimentService;
    let collection: EnvironmentVariableCollection & {
        getScopedEnvironmentVariableCollection(scope: EnvironmentVariableScope): EnvironmentVariableCollection;
    };
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
        collection = mock<
            EnvironmentVariableCollection & {
                getScopedEnvironmentVariableCollection(scope: EnvironmentVariableScope): EnvironmentVariableCollection;
            }
        >();
        when(context.getEnvironmentVariableCollection(anything())).thenReturn(instance(collection));
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
        when(environmentActivationService.getProcessEnvironmentVariables(anything(), anything())).thenResolve(
            process.env,
        );
        configService = mock<IConfigurationService>();
        when(configService.getSettings(anything())).thenReturn(({
            terminal: { activateEnvironment: true },
            pythonPath: displayPath,
        } as unknown) as IPythonSettings);
        when(collection.clear()).thenResolve();
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
        const envVars: NodeJS.ProcessEnv = { CONDA_PREFIX: 'prefix/to/conda', ...process.env };
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                customShell,
            ),
        ).thenResolve(envVars);

        when(collection.replace(anything(), anything(), anything())).thenResolve();
        when(collection.delete(anything())).thenResolve();

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        verify(collection.clear()).once();
        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda', anything())).once();
    });

    test('If activated variables contain PS1, prefix it using shell integration', async () => {
        const envVars: NodeJS.ProcessEnv = { CONDA_PREFIX: 'prefix/to/conda', ...process.env, PS1: '(prompt)' };
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                customShell,
            ),
        ).thenResolve(envVars);

        when(collection.replace(anything(), anything(), anything())).thenResolve();
        when(collection.delete(anything())).thenResolve();
        let opts: EnvironmentVariableMutatorOptions | undefined;
        when(collection.prepend('PS1', '(prompt)', anything())).thenCall((_, _v, o) => {
            opts = o;
        });

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        verify(collection.clear()).once();
        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda', anything())).once();
        assert.deepEqual(opts, { applyAtProcessCreation: false, applyAtShellIntegration: true });
    });

    test('Verify envs are not applied if env activation is disabled', async () => {
        const envVars: NodeJS.ProcessEnv = { CONDA_PREFIX: 'prefix/to/conda', ...process.env };
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                customShell,
            ),
        ).thenResolve(envVars);

        when(collection.replace(anything(), anything(), anything())).thenResolve();
        when(collection.delete(anything())).thenResolve();
        reset(configService);
        when(configService.getSettings(anything())).thenReturn(({
            terminal: { activateEnvironment: false },
            pythonPath: displayPath,
        } as unknown) as IPythonSettings);

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        verify(collection.clear()).once();
        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda', anything())).never();
    });

    test('Verify correct options are used when applying envs and setting description', async () => {
        const envVars: NodeJS.ProcessEnv = { CONDA_PREFIX: 'prefix/to/conda', ...process.env };
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

        when(collection.replace(anything(), anything(), anything())).thenCall(
            (_e, _v, options: EnvironmentVariableMutatorOptions) => {
                assert.deepEqual(options, { applyAtShellIntegration: true, applyAtProcessCreation: true });
                return Promise.resolve();
            },
        );

        await terminalEnvVarCollectionService._applyCollection(resource, customShell);

        verify(collection.clear()).once();
        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda', anything())).once();
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
        const envVars = { CONDA_PREFIX: 'prefix/to/conda', ...process.env };
        when(
            environmentActivationService.getActivatedEnvironmentVariables(
                anything(),
                undefined,
                undefined,
                defaultShell?.shell,
            ),
        ).thenResolve(envVars);

        when(collection.replace(anything(), anything(), anything())).thenResolve();

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda', anything())).once();
        verify(collection.clear()).twice();
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
        when(collection.delete(anything())).thenResolve();

        await terminalEnvVarCollectionService._applyCollection(undefined, defaultShell?.shell);

        verify(collection.clear()).once();
    });
});
