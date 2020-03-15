// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell, IWorkspaceService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { PythonSettings } from '../../../../client/common/configSettings';
import { PathUtils } from '../../../../client/common/platform/pathUtils';
import { IDataScienceSettings, IPathUtils } from '../../../../client/common/types';
import { JupyterInterpreterSelector } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterSelector';
import { JupyterInterpreterStateStore } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterStateStore';
import { InterpreterSelector } from '../../../../client/interpreter/configuration/interpreterSelector';
import { IInterpreterSelector } from '../../../../client/interpreter/configuration/types';

suite('Data Science - Jupyter Interpreter Picker', () => {
    let picker: JupyterInterpreterSelector;
    let interpreterSelector: IInterpreterSelector;
    let appShell: IApplicationShell;
    let interpreterSelectionState: JupyterInterpreterStateStore;
    let workspace: IWorkspaceService;
    let pathUtils: IPathUtils;
    let dsSettings: IDataScienceSettings;

    setup(() => {
        interpreterSelector = mock(InterpreterSelector);
        interpreterSelectionState = mock(JupyterInterpreterStateStore);
        appShell = mock(ApplicationShell);
        workspace = mock(WorkspaceService);
        pathUtils = mock(PathUtils);
        const pythonSettings = mock(PythonSettings);
        // tslint:disable-next-line: no-any
        dsSettings = {} as any;
        when(pythonSettings.datascience).thenReturn(dsSettings);
        picker = new JupyterInterpreterSelector(
            instance(interpreterSelector),
            instance(appShell),
            instance(interpreterSelectionState),
            instance(workspace),
            instance(pathUtils)
        );
    });

    test('Should display the list of interpreters', async () => {
        // tslint:disable-next-line: no-any
        const interpreters = ['something'] as any[];
        when(interpreterSelector.getSuggestions(undefined)).thenResolve(interpreters);
        when(appShell.showQuickPick(anything(), anything())).thenResolve();

        await picker.selectInterpreter();

        verify(interpreterSelector.getSuggestions(undefined)).once();
        verify(appShell.showQuickPick(anything(), anything())).once();
    });
    test('Selected interpreter must be returned', async () => {
        // tslint:disable-next-line: no-any
        const interpreters = ['something'] as any[];
        // tslint:disable-next-line: no-any
        const interpreter = {} as any;
        when(interpreterSelector.getSuggestions(undefined)).thenResolve(interpreters);
        // tslint:disable-next-line: no-any
        when(appShell.showQuickPick(anything(), anything())).thenResolve({ interpreter } as any);

        const selected = await picker.selectInterpreter();

        assert.isOk(selected === interpreter, 'Not the same instance');
    });
    test('Should display current interpreter path in the picker', async () => {
        // tslint:disable-next-line: no-any
        const interpreters = ['something'] as any[];
        const displayPath = 'Display Path';
        when(interpreterSelectionState.selectedPythonPath).thenReturn('jupyter.exe');
        when(pathUtils.getDisplayName('jupyter.exe', anything())).thenReturn(displayPath);
        when(interpreterSelector.getSuggestions(undefined)).thenResolve(interpreters);
        when(appShell.showQuickPick(anything(), anything())).thenResolve();

        await picker.selectInterpreter();

        assert.equal(capture(appShell.showQuickPick).first()[1]?.placeHolder, `current: ${displayPath}`);
    });
});
