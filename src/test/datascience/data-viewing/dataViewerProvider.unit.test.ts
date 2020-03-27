// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as path from 'path';
import { SemVer } from 'semver';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { AsyncDisposableRegistry } from '../../../client/common/asyncDisposableRegistry';
import { Architecture } from '../../../client/common/utils/platform';
import { DataViewer } from '../../../client/datascience/data-viewing/dataViewer';
import { DataViewerDependencyService } from '../../../client/datascience/data-viewing/dataViewerDependencyService';
import { DataViewerProvider } from '../../../client/datascience/data-viewing/dataViewerProvider';
import { JupyterNotebookBase } from '../../../client/datascience/jupyter/jupyterNotebook';
import { IDataViewer, IJupyterVariable, INotebook } from '../../../client/datascience/types';
import { InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Data Science - DataViewerProvider', () => {
    let dataViewerProvider: DataViewerProvider;
    let dataViewer: IDataViewer;
    let serviceContainer: IServiceContainer;
    let dependencyService: DataViewerDependencyService;
    let jupyterVariable: IJupyterVariable;
    let notebook: INotebook;
    let interpreter: PythonInterpreter;
    setup(async () => {
        jupyterVariable = {
            count: 1,
            name: '',
            shape: '',
            size: 1,
            supportsDataExplorer: true,
            truncated: false,
            type: '',
            value: '',
        };
        interpreter = {
            architecture: Architecture.Unknown,
            displayName: '',
            path: path.join('users', 'python', 'bin', 'python.exe'),
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Unknown,
            version: new SemVer('3.3.3'),
        };
        notebook = mock(JupyterNotebookBase);
        serviceContainer = mock(ServiceContainer);
        dataViewer = mock(DataViewer);
        // tslint:disable-next-line: no-any
        (instance(dataViewer) as any).then = undefined;
        // tslint:disable-next-line: no-any
        // (dataViewer as any).then = undefined;
        const asyncRegistry = mock(AsyncDisposableRegistry);
        dependencyService = mock(DataViewerDependencyService);
        when(serviceContainer.get<IDataViewer>(IDataViewer)).thenReturn(instance(dataViewer));
        dataViewerProvider = new DataViewerProvider(
            instance(serviceContainer),
            instance(asyncRegistry),
            instance(dependencyService)
        );
    });
    test('Check and install missing dependencies before displaying variable explorer', async () => {
        const callOrder: string[] = [];
        when(notebook.getMatchingInterpreter()).thenReturn(interpreter);
        when(dependencyService.checkAndInstallMissingDependencies(anything())).thenCall(() =>
            callOrder.push('First Check')
        );
        when(dataViewer.showVariable(anything(), anything())).thenCall(() => callOrder.push('Then Show'));

        await dataViewerProvider.create(jupyterVariable, instance(notebook));

        verify(dependencyService.checkAndInstallMissingDependencies(interpreter)).once();
        verify(dataViewer.showVariable(jupyterVariable, instance(notebook))).once();
        // Couldn't get `calledBefore` working, hence a diryt simple hack.
        assert.deepEqual(callOrder, ['First Check', 'Then Show']);
    });
});
