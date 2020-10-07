// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { nbformat } from '@jupyterlab/coreutils';
import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import * as uuid from 'uuid/v4';
import { Uri } from 'vscode';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IConfigurationService, IDataScienceSettings, IDisposable } from '../../../client/common/types';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { splitMultilineString } from '../../../datascience-ui/common';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import { canRunTests, closeNotebooksAndCleanUpAfterTests, createTemporaryNotebook } from './helper';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - (Trust)', function () {
    this.timeout(15_000);
    const templateIPynb = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'test',
        'datascience',
        'notebook',
        'withOutputForTrust.ipynb'
    );
    let api: IExtensionTestApi;
    let testIPynb: Uri;
    const disposables: IDisposable[] = [];
    suiteSetup(async function () {
        return this.skip();
        this.timeout(15_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
    });
    let oldTrustSetting: boolean;
    let dsSettings: IDataScienceSettings;
    suiteSetup(() => {
        const configService = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        dsSettings = configService.getSettings(testIPynb).datascience;
        oldTrustSetting = dsSettings.alwaysTrustNotebooks;
        dsSettings.alwaysTrustNotebooks = false;
    });
    setup(async () => {
        sinon.restore();
        dsSettings.alwaysTrustNotebooks = false;
        // Don't use same file (due to dirty handling, we might save in dirty.)
        // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
        testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables));
        // Modify ipynb to have random text in code cell, so that it is untrusted.
        const nb: nbformat.INotebookContent = JSON.parse(await fs.readFile(testIPynb.fsPath, { encoding: 'utf8' }));
        nb.cells[0].source = splitMultilineString(`PRINT "${uuid()}"`);
        await fs.writeFile(testIPynb.fsPath, JSON.stringify(nb, undefined, 4));
    });
    teardown(async () => closeNotebooksAndCleanUpAfterTests(disposables));
    suiteTeardown(() => (dsSettings.alwaysTrustNotebooks = oldTrustSetting === true));

    function assertDocumentTrust(document: NotebookDocument, trusted: boolean) {
        assert.equal(document.metadata.cellEditable, trusted);
        assert.equal(document.metadata.cellRunnable, trusted);
        assert.equal(document.metadata.editable, trusted);
        assert.equal(document.metadata.runnable, trusted);

        document.cells.forEach((cell) => {
            assert.equal(cell.metadata.editable, trusted);
            if (cell.cellKind === vscodeNotebookEnums.CellKind.Code) {
                assert.equal(cell.metadata.runnable, trusted);
                // In our test all code cells have outputs.
                if (trusted) {
                    assert.ok(cell.outputs.length, 'No output in trusted cell');
                } else {
                    assert.lengthOf(cell.outputs, 0, 'Cannot have output in non-trusted notebook');
                }
            }
        });
    }

    test('Cannot run/edit un-trusted notebooks, once trusted can edit/run', async () => {
        const editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        const model = (await editorProvider.open(testIPynb))!.model!;

        const document = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook).activeNotebookEditor!.document;
        assert.equal(model.isTrusted, false);
        assertDocumentTrust(document, false);

        model.trust();
        assert.equal(model.isTrusted, true);
        assertDocumentTrust(document, true);
    });
});
