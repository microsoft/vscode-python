// Licensed under the MIT License.
// Copyright (c) Microsoft Corporation. All rights reserved.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any
import { nbformat } from '@jupyterlab/coreutils';
import { assert } from 'chai';
import * as path from 'path';
import { Uri } from 'vscode';
import { ExportUtil } from '../../../client/datascience/export/exportUtil';
import { INotebookStorage } from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { closeActiveWindows, initialize } from '../../initialize';

suite('DataScience - Export Util', () => {
    let api: IExtensionTestApi;
    suiteSetup(async function () {
        this.timeout(10_000);
        api = await initialize();
        // Export Util tests require jupyter to run. Othewrise can't
        // run any of our variable execution code
        const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;
        if (!isRollingBuild) {
            // tslint:disable-next-line:no-console
            console.log('Skipping Export Util tests. Requires python environment');
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });
    teardown(closeActiveWindows);
    suiteTeardown(closeActiveWindows);
    test('Remove svgs from model', async () => {
        const exportUtil = api.serviceContainer.get<ExportUtil>(ExportUtil);
        const notebookStorage = api.serviceContainer.get<INotebookStorage>(INotebookStorage);
        const file = Uri.file(
            path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'datascience', 'export', 'testPDF.ipynb')
        );

        await exportUtil.removeSvgs(file);
        const model = await notebookStorage.get(file);

        // make sure no svg exists in model
        const SVG = 'image/svg+xml';
        const PNG = 'image/png';
        for (const cell of model.cells) {
            const outputs = cell.data.outputs;
            if (outputs as nbformat.IOutput[]) {
                for (const output of outputs as nbformat.IOutput[]) {
                    if (output.data as nbformat.IMimeBundle) {
                        const data = output.data as nbformat.IMimeBundle;
                        if (PNG in data) {
                            // we only remove svgs if there is a pdf available
                            assert.equal(SVG in data, false);
                        }
                    }
                }
            }
        }
    });
});
