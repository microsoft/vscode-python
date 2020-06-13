// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anyString, anything, instance, mock, verify, when } from 'ts-mockito';
import { Memento } from 'vscode';
import { Architecture } from '../../../../client/common/utils/platform';
import {
    JupyterInterpreterDependencyResponse,
    JupyterInterpreterDependencyService
} from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterDependencyService';
import { JupyterInterpreterOldCacheStateStore } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterOldCacheStateStore';
import { JupyterInterpreterSelector } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterSelector';
import { JupyterInterpreterService } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterService';
import { JupyterInterpreterStateStore } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterStateStore';
import { IInterpreterService } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
import { InterpreterType, PythonInterpreter } from '../../../../client/pythonEnvironments/discovery/types';
import { MockMemento } from '../../../mocks/mementos';
import { createPythonInterpreter } from '../../../utils/interpreters';

// tslint:disable: max-func-body-length

suite('Data Science - Jupyter Interpreter Service', () => {
    let jupyterInterpreterService: JupyterInterpreterService;
    let interpreterSelector: JupyterInterpreterSelector;
    let interpreterConfiguration: JupyterInterpreterDependencyService;
    let interpreterService: IInterpreterService;
    let selectedInterpreterEventArgs: PythonInterpreter | undefined;
    let memento: Memento;
    let interpreterSelectionState: JupyterInterpreterStateStore;
    let oldVersionCacheStateStore: JupyterInterpreterOldCacheStateStore;
    const selectedJupyterInterpreter = createPythonInterpreter({ displayName: 'JupyterInterpreter' });
    const pythonInterpreter: PythonInterpreter = {
        path: 'some path',
        architecture: Architecture.Unknown,
        sysPrefix: '',
        sysVersion: '',
        type: InterpreterType.Unknown
    };
    const secondPythonInterpreter: PythonInterpreter = {
        path: 'second interpreter path',
        architecture: Architecture.Unknown,
        sysPrefix: '',
        sysVersion: '',
        type: InterpreterType.Unknown
    };

    setup(() => {
        interpreterSelector = mock(JupyterInterpreterSelector);
        interpreterConfiguration = mock(JupyterInterpreterDependencyService);
        interpreterService = mock(InterpreterService);
        memento = mock(MockMemento);
        interpreterSelectionState = mock(JupyterInterpreterStateStore);
        oldVersionCacheStateStore = mock(JupyterInterpreterOldCacheStateStore);
        jupyterInterpreterService = new JupyterInterpreterService(
            instance(oldVersionCacheStateStore),
            instance(interpreterSelectionState),
            instance(interpreterSelector),
            instance(interpreterConfiguration),
            instance(interpreterService)
        );
        when(interpreterService.getInterpreterDetails(pythonInterpreter.path, undefined)).thenResolve(
            pythonInterpreter
        );
        when(interpreterService.getInterpreterDetails(secondPythonInterpreter.path, undefined)).thenResolve(
            secondPythonInterpreter
        );
        when(memento.update(anything(), anything())).thenResolve();
        jupyterInterpreterService.onDidChangeInterpreter((e) => (selectedInterpreterEventArgs = e));
        when(interpreterSelector.selectInterpreter()).thenResolve(pythonInterpreter);
    });

    test('Cancelling interpreter configuration is same as cancelling selection of an interpreter', async () => {
        when(
            interpreterConfiguration.installMissingDependencies(pythonInterpreter, anything(), anything())
        ).thenResolve(JupyterInterpreterDependencyResponse.cancel);

        const response = await jupyterInterpreterService.selectInterpreter();

        assert.equal(response, undefined);
        assert.isUndefined(selectedInterpreterEventArgs);
    });
    test('Once selected interpreter must be stored in settings and event fired', async () => {
        when(
            interpreterConfiguration.installMissingDependencies(pythonInterpreter, anything(), anything())
        ).thenResolve(JupyterInterpreterDependencyResponse.ok);

        const response = await jupyterInterpreterService.selectInterpreter();

        verify(interpreterConfiguration.installMissingDependencies(pythonInterpreter, anything(), anything())).once();
        assert.equal(response, pythonInterpreter);
        assert.equal(selectedInterpreterEventArgs, pythonInterpreter);

        // Selected interpreter should be returned.
        const selectedInterpreter = await jupyterInterpreterService.selectInterpreter();

        assert.equal(selectedInterpreter, pythonInterpreter);
    });
    test('Select another interpreter if user opts to not install dependencies', async () => {
        when(
            interpreterConfiguration.installMissingDependencies(pythonInterpreter, anything(), anything())
        ).thenResolve(JupyterInterpreterDependencyResponse.selectAnotherInterpreter);
        when(
            interpreterConfiguration.installMissingDependencies(secondPythonInterpreter, anything(), anything())
        ).thenResolve(JupyterInterpreterDependencyResponse.ok);
        let interpreterSelection = 0;
        when(interpreterSelector.selectInterpreter()).thenCall(() => {
            // When selecting intererpter for first time, return first interpreter
            // When selected interpretre
            interpreterSelection += 1;
            return interpreterSelection === 1 ? pythonInterpreter : secondPythonInterpreter;
        });

        const response = await jupyterInterpreterService.selectInterpreter();

        verify(interpreterSelector.selectInterpreter()).twice();
        assert.equal(response, secondPythonInterpreter);
        assert.equal(selectedInterpreterEventArgs, secondPythonInterpreter);

        // Selected interpreter should be the second interpreter.
        const selectedInterpreter = await jupyterInterpreterService.selectInterpreter();

        assert.equal(selectedInterpreter, secondPythonInterpreter);
    });
    test('setInitialInterpreter if older version is set should use and clear', async () => {
        when(oldVersionCacheStateStore.getCachedInterpreterPath()).thenReturn(pythonInterpreter.path);
        when(oldVersionCacheStateStore.clearCache()).thenResolve();
        when(interpreterConfiguration.areDependenciesInstalled(pythonInterpreter, anything())).thenResolve(true);
        const initialInterpreter = await jupyterInterpreterService.setInitialInterpreter(undefined);
        verify(oldVersionCacheStateStore.clearCache()).once();
        assert.equal(initialInterpreter, pythonInterpreter);
    });
    test('setInitialInterpreter use saved interpreter if valid', async () => {
        when(oldVersionCacheStateStore.getCachedInterpreterPath()).thenReturn(undefined);
        when(interpreterSelectionState.selectedPythonPath).thenReturn(pythonInterpreter.path);
        when(interpreterConfiguration.areDependenciesInstalled(pythonInterpreter, anything())).thenResolve(true);
        const initialInterpreter = await jupyterInterpreterService.setInitialInterpreter(undefined);
        assert.equal(initialInterpreter, pythonInterpreter);
    });
    test('setInitialInterpreter saved interpreter invalid, clear it and use active interpreter', async () => {
        when(oldVersionCacheStateStore.getCachedInterpreterPath()).thenReturn(undefined);
        when(interpreterSelectionState.selectedPythonPath).thenReturn(secondPythonInterpreter.path);
        when(interpreterConfiguration.areDependenciesInstalled(secondPythonInterpreter, anything())).thenResolve(false);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(pythonInterpreter);
        when(interpreterConfiguration.areDependenciesInstalled(pythonInterpreter, anything())).thenResolve(true);
        const initialInterpreter = await jupyterInterpreterService.setInitialInterpreter(undefined);
        assert.equal(initialInterpreter, pythonInterpreter);
        // Make sure we set our saved interpreter to the new active interpreter
        // it should have been cleared to undefined, then set to a new value
        verify(interpreterSelectionState.updateSelectedPythonPath(undefined)).once();
        verify(interpreterSelectionState.updateSelectedPythonPath(anyString())).once();
    });
    test('Install missing dependencies into active interpreter', async () => {
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(pythonInterpreter);
        await jupyterInterpreterService.installMissingDependencies(undefined);
        verify(interpreterConfiguration.installMissingDependencies(pythonInterpreter, undefined)).once();
    });
    test('Install missing dependencies into jupyter interpreter', async () => {
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(undefined);
        when(interpreterSelector.selectInterpreter()).thenResolve(selectedJupyterInterpreter);
        when(
            interpreterConfiguration.installMissingDependencies(selectedJupyterInterpreter, anything(), anything())
        ).thenResolve(JupyterInterpreterDependencyResponse.ok);
        // First select our interpreter
        await jupyterInterpreterService.selectInterpreter();
        await jupyterInterpreterService.installMissingDependencies(undefined);
        verify(interpreterConfiguration.installMissingDependencies(selectedJupyterInterpreter, undefined)).once();
    });
    test('Display picker if no interpreters are selected', async () => {
        when(interpreterService.getActiveInterpreter(undefined)).thenResolve(undefined);
        when(interpreterSelector.selectInterpreter()).thenResolve(selectedJupyterInterpreter);
        when(
            interpreterConfiguration.installMissingDependencies(selectedJupyterInterpreter, anything(), anything())
        ).thenResolve(JupyterInterpreterDependencyResponse.ok);
        await jupyterInterpreterService.installMissingDependencies(undefined);
        verify(interpreterSelector.selectInterpreter()).once();
    });
});
