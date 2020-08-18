// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { EventEmitter, Memento } from 'vscode';
import { JupyterInterpreterService } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterService';
import { JupyterInterpreterStateStore } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterStateStore';
import { PythonEnvironment } from '../../../../client/pythonEnvironments/info';
import { MockMemento } from '../../../mocks/mementos';

suite('DataScience - Jupyter Interpreter State', () => {
    let selected: JupyterInterpreterStateStore;
    let memento: Memento;
    let interpreterService: JupyterInterpreterService;
    let interpreterSelectedEventEmitter: EventEmitter<PythonEnvironment>;

    setup(() => {
        memento = mock(MockMemento);
        interpreterService = mock(JupyterInterpreterService);
        when(memento.update(anything(), anything())).thenResolve();
        interpreterSelectedEventEmitter = new EventEmitter<PythonEnvironment>();
        when(interpreterService.onDidChangeInterpreter).thenReturn(interpreterSelectedEventEmitter.event);
        selected = new JupyterInterpreterStateStore(instance(memento));
    });

    test('Interpeter should not be set for fresh installs', async () => {
        when(memento.get(anything(), false)).thenReturn(false);

        assert.isFalse(selected.interpreterSetAtleastOnce);
    });
    test('If memento is set (for subsequent sesssions), return true', async () => {
        when(memento.get<string | undefined>(anything(), undefined)).thenReturn('jupyter.exe');

        assert.isOk(selected.interpreterSetAtleastOnce);
    });
    test('Get python path from memento', async () => {
        when(memento.get<string | undefined>(anything(), undefined)).thenReturn('jupyter.exe');

        assert.equal(selected.selectedPythonPath, 'jupyter.exe');
    });
});
