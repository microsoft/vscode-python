// Licensed under the MIT License.
// Copyright (c) Microsoft Corporation. All rights reserved.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any
import { assert } from 'chai';
import * as path from 'path';
import { Uri } from 'vscode';
import { IDocumentManager } from '../../../client/common/application/types';
import { ExportFormat, IExport } from '../../../client/datascience/export/exportManager';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { closeActiveWindows, initialize } from '../../initialize';

suite('DataScience - Export Python', () => {
    let api: IExtensionTestApi;
    suiteSetup(async function () {
        this.timeout(10_000);
        api = await initialize();
    });
    teardown(closeActiveWindows);
    suiteTeardown(closeActiveWindows);
    test('Export To Python', async () => {
        const exportToPython = api.serviceContainer.get<IExport>(IExport, ExportFormat.python);

        await exportToPython.export(
            Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'datascience', 'export', 'test.ipynb'))
        );

        const documentManager = api.serviceContainer.get<IDocumentManager>(IDocumentManager);
        assert.include(documentManager.activeTextEditor!.document.getText(), 'tim = 1');
    });
});
