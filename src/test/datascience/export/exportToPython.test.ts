// Licensed under the MIT License.
// Copyright (c) Microsoft Corporation. All rights reserved.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any
import { assert } from 'chai';
import * as path from 'path';
import { CancellationTokenSource, Uri } from 'vscode';
import { IDocumentManager } from '../../../client/common/application/types';
import { ExportInterpreterFinder } from '../../../client/datascience/export/exportInterpreterFinder';
import { ExportFormat, IExport } from '../../../client/datascience/export/types';
import { IDataScienceFileSystem } from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { closeActiveWindows, initialize } from '../../initialize';

suite('DataScience - Export Python', () => {
    let api: IExtensionTestApi;
    suiteSetup(async function () {
        this.timeout(10_000);
        api = await initialize();
        // Export to Python tests require jupyter to run. Othewrise can't
        // run any of our variable execution code
        const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;
        if (!isRollingBuild) {
            // tslint:disable-next-line:no-console
            console.log('Skipping Export to Python tests. Requires python environment');
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });
    teardown(closeActiveWindows);
    suiteTeardown(closeActiveWindows);
    test('Export To Python', async () => {
        const fileSystem = api.serviceContainer.get<IDataScienceFileSystem>(IDataScienceFileSystem);
        const exportToPython = api.serviceContainer.get<IExport>(IExport, ExportFormat.python);
        const target = Uri.file((await fileSystem.createTemporaryLocalFile('.py')).filePath);
        const token = new CancellationTokenSource();
        const exportInterpreterFinder = api.serviceContainer.get<ExportInterpreterFinder>(ExportInterpreterFinder);
        const interpreter = await exportInterpreterFinder.getExportInterpreter(ExportFormat.html);
        await exportToPython.export(
            Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'datascience', 'export', 'test.ipynb')),
            target,
            interpreter,
            token.token
        );

        const documentManager = api.serviceContainer.get<IDocumentManager>(IDocumentManager);
        assert.include(documentManager.activeTextEditor!.document.getText(), 'tim = 1');
    });
});
