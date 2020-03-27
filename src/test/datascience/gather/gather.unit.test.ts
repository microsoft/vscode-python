// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import {
    IConfigurationService,
    IDataScienceSettings,
    IDisposableRegistry,
    IPythonSettings,
} from '../../../client/common/types';
import { GatherProvider } from '../../../client/datascience/gather/gather';
import { ICell as IVscCell } from '../../../client/datascience/types';

// tslint:disable-next-line: max-func-body-length
suite('DataScience code gathering unit tests', () => {
    const codeCells: IVscCell[] = [
        {
            id: '72ce5eda-e03a-454b-bfdf-7d53c4bfa91f',
            file: '2DB9B899-6519-4E1B-88B0-FA728A274115',
            line: 0,
            state: 2,
            data: {
                source: `from bokeh.plotting import show, figure, output_notebook\noutput_notebook()`,
                cell_type: 'code',
                outputs: [],
                metadata: {},
                execution_count: 1,
            },
        },
        {
            id: '7243c0aa-cf06-4b2f-b557-2d1dcedda943',
            file: '2DB9B899-6519-4E1B-88B0-FA728A274115',
            line: 0,
            state: 2,
            data: {
                source: `x = [1,2,3,4,5]\ny = [21,9,15,17,4]\nprint('This is some irrelevant code')`,
                cell_type: 'code',
                outputs: [],
                metadata: {},
                execution_count: 2,
            },
        },
        {
            id: 'c510bfd2-5ab5-4879-b877-8d993983c822',
            file: '2DB9B899-6519-4E1B-88B0-FA728A274115',
            line: 0,
            state: 2,
            data: {
                source: `p=figure(title='demo',x_axis_label='x',y_axis_label='y')`,
                cell_type: 'code',
                outputs: [],
                metadata: {},
                execution_count: 3,
            },
        },
        {
            id: '4e227548-1337-4894-991a-8f9a92523897',
            file: '2DB9B899-6519-4E1B-88B0-FA728A274115',
            line: 0,
            state: 2,
            data: {
                source: 'p.line(x,y,line_width=2)',
                cell_type: 'code',
                outputs: [],
                metadata: {},
                execution_count: 4,
            },
        },
        {
            id: '5912d201-dca5-4e5b-ab8a-7ce383e86bbb',
            file: '2DB9B899-6519-4E1B-88B0-FA728A274115',
            line: 0,
            state: 2,
            data: {
                source: 'show(p)',
                cell_type: 'code',
                outputs: [],
                metadata: {},
                execution_count: 5,
            },
        },
    ];

    const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
    const commandManager = TypeMoq.Mock.ofType<ICommandManager>();
    const disposableRegistry = TypeMoq.Mock.ofType<IDisposableRegistry>();
    const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
    const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
    const dataScienceSettings = TypeMoq.Mock.ofType<IDataScienceSettings>();
    const gatherRules = [
        {
            objectName: 'df',
            functionName: 'head',
            doesNotModify: ['OBJECT'],
        },
        {
            objectName: 'df',
            functionName: 'tail',
            doesNotModify: ['OBJECT'],
        },
        {
            objectName: 'df',
            functionName: 'describe',
            doesNotModify: ['OBJECT'],
        },
        {
            functionName: 'print',
            doesNotModify: ['ARGUMENTS'],
        },
        {
            functionName: 'KMeans',
            doesNotModify: ['ARGUMENTS'],
        },
        {
            functionName: 'scatter',
            doesNotModify: ['ARGUMENTS'],
        },
        {
            functionName: 'fit',
            doesNotModify: ['ARGUMENTS'],
        },
        {
            functionName: 'sum',
            doesNotModify: ['ARGUMENTS'],
        },
        {
            functionName: 'len',
            doesNotModify: ['ARGUMENTS'],
        },
    ];

    dataScienceSettings.setup((d) => d.gatherRules).returns(() => gatherRules);
    dataScienceSettings.setup((d) => d.enabled).returns(() => true);
    dataScienceSettings.setup((d) => d.defaultCellMarker).returns(() => '# %%');
    pythonSettings.setup((p) => p.datascience).returns(() => dataScienceSettings.object);
    configurationService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
    appShell
        .setup((a) => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
        .returns(() => Promise.resolve(''));
    const gatherProvider = new GatherProvider(
        configurationService.object,
        appShell.object,
        disposableRegistry.object,
        commandManager.object
    );

    if (gatherProvider) {
        // Disabling this test as by default gather cannot operate successfully without python-program-analysis.
        // test('Logs a cell execution', async () => {
        //     let count = 0;
        //     for (const c of codeCells) {
        //         await gatherLogger.postExecute(c, false);
        //         count += 1;
        //         const logLength = gatherProvider.executionSlicer?.executionLog.length;
        //         assert.equal(logLength, count);
        //     }
        // });

        test('Gathers program slices for a cell', async () => {
            const cell: IVscCell = codeCells[codeCells.length - 1];
            const program = gatherProvider.gatherCode(cell);
            const expectedProgram = '# %% [markdown]\n## Gather not available';
            assert.equal(program.trim(), expectedProgram.trim());
        });
    }
});
