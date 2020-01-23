// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ExperimentsManager } from '../../../client/common/experiments';
import { IExperimentsManager, Resource } from '../../../client/common/types';
import { Architecture } from '../../../client/common/utils/platform';
import { EnvironmentVariablesProvider } from '../../../client/common/variables/environmentVariablesProvider';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { TerminalEnvironmentActivationService } from '../../../client/interpreter/activation/terminalEnvironmentActivationService';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { WrapperEnvironmentActivationService } from '../../../client/interpreter/activation/wrapperEnvironmentActivationService';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { FakeClock } from '../../common';

// tslint:disable-next-line: max-func-body-length
suite('xInterpreters Activation - Python Environment Variables (wrap terminal and proc approach)', () => {
    let envActivationService: IEnvironmentActivationService;
    let procActivation: IEnvironmentActivationService;
    let termActivation: IEnvironmentActivationService;
    let experiment: IExperimentsManager;
    let interpreterService: IInterpreterService;
    let workspace: IWorkspaceService;
    let envVarsProvider: IEnvironmentVariablesProvider;
    let onDidChangeEnvVars: EventEmitter<Resource>;
    let timer: FakeClock;
    const mockInterpreter: PythonInterpreter = {
        architecture: Architecture.Unknown,
        path: '',
        sysPrefix: '',
        sysVersion: '',
        type: InterpreterType.Conda
    };

    // tslint:disable-next-line: max-func-body-length
    [undefined, Uri.file('some Resource')].forEach(resource => {
        // tslint:disable-next-line: max-func-body-length
        [undefined, mockInterpreter].forEach(interpreter => {
            // tslint:disable-next-line: max-func-body-length
            suite(resource ? 'With a resource' : 'Without a resource', () => {
                setup(() => {
                    onDidChangeEnvVars = new EventEmitter<Resource>();
                    envVarsProvider = mock(EnvironmentVariablesProvider);
                    procActivation = mock(EnvironmentActivationService);
                    termActivation = mock(TerminalEnvironmentActivationService);
                    experiment = mock(ExperimentsManager);
                    interpreterService = mock(InterpreterService);
                    workspace = mock(WorkspaceService);

                    when(experiment.inExperiment(anything())).thenReturn(true);
                    when(envVarsProvider.onDidEnvironmentVariablesChange).thenReturn(onDidChangeEnvVars.event);
                    // Generate a unique key based on resource.
                    when(workspace.getWorkspaceFolderIdentifier(anything())).thenCall((identifier: Resource) => identifier?.fsPath || '');
                    envActivationService = new WrapperEnvironmentActivationService(
                        instance(procActivation),
                        instance(termActivation),
                        instance(experiment),
                        instance(interpreterService),
                        instance(workspace),
                        instance(envVarsProvider),
                        []
                    );
                    timer = new FakeClock();
                    timer.install();
                });
                teardown(() => timer.uninstall());
                // tslint:disable-next-line: max-func-body-length
                suite(interpreter ? 'With an interpreter' : 'Without an interpreter', () => {
                    test('Environment variables returned by process provider should be used if terminal provider crashes', async () => {
                        const expectedVars = { WOW: '1' };
                        when(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thenReject(new Error('kaboom'));
                        when(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thenResolve(expectedVars);

                        const promise = envActivationService.getActivatedEnvironmentVariables(resource, interpreter);
                        await timer.wait();
                        const vars = await promise;

                        assert.deepEqual(vars, expectedVars);
                        verify(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                        verify(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                    });
                    test('Use cached variables returned by process provider should be used if terminal provider crashes', async () => {
                        const expectedVars = { WOW: '1' };
                        when(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thenReject(new Error('kaboom'));
                        when(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thenResolve(expectedVars);

                        let promise = envActivationService.getActivatedEnvironmentVariables(resource, interpreter);
                        await timer.wait();
                        let vars = await promise;

                        assert.deepEqual(vars, expectedVars);
                        verify(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                        verify(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();

                        promise = envActivationService.getActivatedEnvironmentVariables(resource, interpreter);
                        await timer.wait();
                        vars = await promise;
                        assert.deepEqual(vars, expectedVars);
                        verify(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                        verify(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                    });
                    test('Environment variables returned by terminal provider should be used if that returns any variables', async () => {
                        const expectedVars = { WOW: '1' };
                        when(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thenResolve(expectedVars);
                        when(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thenResolve({ somethingElse: '1' });

                        const promise = envActivationService.getActivatedEnvironmentVariables(resource, interpreter);
                        await timer.wait();
                        const vars = await promise;

                        assert.deepEqual(vars, expectedVars);
                        verify(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                        verify(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                    });
                    test('Environment variables returned by terminal provider should be used if that returns any variables', async () => {
                        const expectedVars = { WOW: '1' };
                        when(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thenResolve(expectedVars);
                        when(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thenResolve({ somethingElse: '1' });

                        let promise = envActivationService.getActivatedEnvironmentVariables(resource, interpreter);
                        await timer.wait();
                        let vars = await promise;

                        assert.deepEqual(vars, expectedVars);
                        verify(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                        verify(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();

                        promise = envActivationService.getActivatedEnvironmentVariables(resource, interpreter);
                        await timer.wait();
                        vars = await promise;
                        assert.deepEqual(vars, expectedVars);
                        verify(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                        verify(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                    });
                    test('Will not use cached info, if passing different resource or interpreter', async () => {
                        const expectedVars = { WOW: '1' };
                        when(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thenResolve(expectedVars);
                        when(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thenResolve({ somethingElse: '1' });

                        let promise = envActivationService.getActivatedEnvironmentVariables(resource, interpreter);
                        await timer.wait();
                        let vars = await promise;

                        assert.deepEqual(vars, expectedVars);
                        verify(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                        verify(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();

                        // Same resource, hence return cached info.
                        promise = envActivationService.getActivatedEnvironmentVariables(resource, interpreter);
                        await timer.wait();
                        vars = await promise;
                        assert.deepEqual(vars, expectedVars);
                        verify(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();
                        verify(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).once();

                        // Invoke again with a different resource.
                        const newResource = Uri.file('New Resource');
                        when(termActivation.getActivatedEnvironmentVariables(newResource, anything(), anything())).thenResolve(undefined);
                        when(procActivation.getActivatedEnvironmentVariables(newResource, anything(), anything())).thenResolve({ NewVars: '1' });

                        promise = envActivationService.getActivatedEnvironmentVariables(newResource, undefined);
                        await timer.wait();
                        vars = await promise;
                        assert.deepEqual(vars, { NewVars: '1' });
                        verify(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).twice();
                        verify(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).twice();

                        // Invoke again with a different python interpreter.
                        const newInterpreter: PythonInterpreter = { architecture: Architecture.x64, path: 'New', sysPrefix: '', sysVersion: '', type: InterpreterType.Pipenv };
                        when(termActivation.getActivatedEnvironmentVariables(anything(), newInterpreter, anything())).thenResolve({ NewPythonVars: '1' });
                        when(procActivation.getActivatedEnvironmentVariables(anything(), newInterpreter, anything())).thenResolve(undefined);

                        promise = envActivationService.getActivatedEnvironmentVariables(newResource, newInterpreter);
                        await timer.wait();
                        vars = await promise;
                        assert.deepEqual(vars, { NewPythonVars: '1' });
                        verify(termActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thrice();
                        verify(procActivation.getActivatedEnvironmentVariables(anything(), anything(), anything())).thrice();
                    });
                });
            });
        });
    });
});
