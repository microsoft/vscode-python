// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as sinon from 'sinon';
import { assert, expect } from 'chai';
import { cloneDeep } from 'lodash';
import { mock, instance, when, anything, verify, reset } from 'ts-mockito';
import { EnvironmentVariableCollection, ProgressLocation, Uri } from 'vscode';
import { IApplicationShell, IApplicationEnvironment } from '../../../client/common/application/types';
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
import { getOSType } from '../../../client/common/utils/platform';
import { defaultShells } from '../../../client/interpreter/activation/service';
import {
    TerminalEnvVarCollectionService,
    _normCaseKeys,
} from '../../../client/interpreter/activation/terminalEnvVarCollectionService';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';

suite('Terminal Environment Variable Collection Service', () => {
    let platform: IPlatformService;
    let interpreterService: IInterpreterService;
    let context: IExtensionContext;
    let shell: IApplicationShell;
    let experimentService: IExperimentService;
    let collection: EnvironmentVariableCollection;
    let applicationEnvironment: IApplicationEnvironment;
    let environmentActivationService: IEnvironmentActivationService;
    let terminalEnvVarCollectionService: TerminalEnvVarCollectionService;
    const progressOptions = {
        location: ProgressLocation.Window,
        title: Interpreters.activatingTerminals,
    };
    const customShell = 'powershell';
    const defaultShell = defaultShells[getOSType()];

    setup(() => {
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
        const configService = mock<IConfigurationService>();
        when(configService.getSettings(anything())).thenReturn(({
            terminal: { activateEnvironment: true },
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
            instance(configService),
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
        await terminalEnvVarCollectionService.activate();
        assert(applyCollectionStub.calledOnce, 'Collection not applied on activation');
    });

    test('When not in experiment, do not apply activated variables to the collection and clear it instead', async () => {
        reset(experimentService);
        when(experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)).thenReturn(false);
        const applyCollectionStub = sinon.stub(terminalEnvVarCollectionService, '_applyCollection');
        applyCollectionStub.resolves();
        when(interpreterService.onDidChangeInterpreter(anything(), anything(), anything())).thenReturn();
        when(applicationEnvironment.onDidChangeShell(anything(), anything(), anything())).thenReturn();

        await terminalEnvVarCollectionService.activate();

        verify(interpreterService.onDidChangeInterpreter(anything(), anything(), anything())).never();
        verify(applicationEnvironment.onDidChangeShell(anything(), anything(), anything())).never();
        assert(applyCollectionStub.notCalled, 'Collection should not be applied on activation');

        verify(collection.clear()).once();
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
        await terminalEnvVarCollectionService.activate();

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
        await terminalEnvVarCollectionService.activate();

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

        when(collection.replace(anything(), anything())).thenResolve();
        when(collection.delete(anything())).thenResolve();

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda')).once();
        verify(collection.delete('PATH')).once();
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

        when(collection.replace(anything(), anything())).thenResolve();
        when(collection.delete(anything())).thenResolve();

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

        verify(collection.delete('CONDA_PREFIX')).once();
        verify(collection.delete('RANDOM_VAR')).once();
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

        when(collection.replace(anything(), anything())).thenResolve();
        when(collection.delete(anything())).thenResolve();

        await terminalEnvVarCollectionService._applyCollection(undefined, customShell);

        verify(collection.replace('CONDA_PREFIX', 'prefix/to/conda')).once();
        verify(collection.delete(anything())).never();
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

        when(collection.replace(anything(), anything())).thenResolve();
        when(collection.delete(anything())).thenResolve();

        await terminalEnvVarCollectionService._applyCollection(undefined, defaultShell?.shell);

        verify(collection.clear()).once();
    });
});
