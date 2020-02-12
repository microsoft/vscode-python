// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
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
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
import { MockMemento } from '../../../mocks/mementos';

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
        jupyterInterpreterService.onDidChangeInterpreter(e => (selectedInterpreterEventArgs = e));
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
});
