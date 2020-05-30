// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationEnvironment, IVSCodeNotebook } from '../../../client/common/application/types';
import { IConfigurationService, IDisposable } from '../../../client/common/types';
import { NotebookModelChange } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { INotebookEditorProvider, INotebookModel } from '../../../client/datascience/types';
import { splitMultilineString } from '../../../datascience-ui/common';
import { createCodeCell, createMarkdownCell } from '../../../datascience-ui/common/cellFactory';
import { IExtensionTestApi, TestEventHandler, waitForCondition } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { closeActiveWindows, initialize, initializeTest } from '../../initialize';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

suite('DataScience - VSCode Notebook (Cell Updates)', function () {
    // tslint:disable-next-line: no-invalid-this
    this.timeout(55_000);
    let handler: TestEventHandler<NotebookModelChange>;
    const templateIPynb = Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'datascience', 'test.ipynb'));
    const testIPynb = Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'tmp', 'test.ipynb'));

    let api: IExtensionTestApi;
    let vscodeNotebook: IVSCodeNotebook;
    let editorProvider: INotebookEditorProvider;
    const disposables: IDisposable[] = [];
    let oldValueFor_disableJupyterAutoStart: undefined | boolean = false;
    suiteSetup(async function () {
        if (await fs.pathExists(testIPynb.fsPath)) {
            await fs.unlink(testIPynb.fsPath);
        }
        await fs.copyFile(templateIPynb.fsPath, testIPynb.fsPath);

        api = await initialize();
        const appEnv = api.serviceContainer.get<IApplicationEnvironment>(IApplicationEnvironment);
        if (appEnv.extensionChannel === 'stable') {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        oldValueFor_disableJupyterAutoStart = configSettings.getSettings(undefined).datascience.disableJupyterAutoStart;
    });
    setup(async () => {
        await initializeTest();
        // Reset for tests, do this every time, as things can change due to config changes etc.
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        configSettings.getSettings(undefined).datascience.disableJupyterAutoStart = true;
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
    });
    teardown(async () => {
        await closeActiveWindows();
        while (disposables.length) {
            disposables.pop()?.dispose(); // NOSONAR;
        }
    });
    suiteTeardown(async () => {
        // Restore.
        const configSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        configSettings.getSettings(undefined).datascience.disableJupyterAutoStart = oldValueFor_disableJupyterAutoStart;
        await closeActiveWindows();
    });

    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Add tests for existing nb (VSC API isnt' working).
    [true].forEach((isUntitled) => {
        suite(isUntitled ? 'Untitled Notebook' : 'Existing Notebook', () => {
            let model: INotebookModel;
            setup(async () => {
                const editor = isUntitled ? await editorProvider.createNew() : await editorProvider.open(testIPynb);
                handler = new TestEventHandler(editor.model!.changed, disposables);
                model = editor.model!;
            });

            test('Deleting a cell in an nb should trigger updates in our NotebookModel', async () => {
                const activeEditor = vscodeNotebook.activeNotebookEditor;

                // Delete first cell.
                await new Promise((resolve) =>
                    activeEditor?.edit((builder) => {
                        builder.delete(0);
                        resolve();
                    })
                );

                // Verify events were fired.
                await waitForCondition(async () => handler.fired, 5_000, 'Change event not fired');
                assert.ok(handler.fired);
                assert.equal(handler.count, 1, 'More than one update fired');
                assert.equal(handler.first.kind, 'remove', 'Incorrect event fired');

                // Verify model state is correct.
                assert.equal(model.cells.length, 0);
            });
            test('Adding a markdown cell in an nb should trigger updates in our NotebookModel', async () => {
                const activeEditor = vscodeNotebook.activeNotebookEditor;

                await new Promise((resolve) =>
                    activeEditor?.edit((builder) => {
                        builder.insert(0, 'HELLO', 'markdown', vscodeNotebookEnums.CellKind.Markdown, [], undefined);
                        resolve();
                    })
                );

                // Verify events were fired.
                await waitForCondition(async () => handler.fired, 5_000, 'Change event not fired');
                assert.ok(handler.fired);
                assert.equal(handler.count, 1, 'More than one update fired');
                assert.equal(handler.first.kind, 'insert', 'Incorrect event fired');
                if (handler.first.kind === 'insert') {
                    const expectedCell = createMarkdownCell(splitMultilineString(['HELLO']), true);
                    assert.equal(handler.first.index, 0);
                    assert.deepEqual(handler.first.cell.data, expectedCell);
                }

                // Verify model has been updated
                assert.equal(model.cells.length, 2);
            });
            test('Adding a code cell in an nb should trigger updates in our NotebookModel', async () => {
                const activeEditor = vscodeNotebook.activeNotebookEditor;

                await new Promise((resolve) =>
                    activeEditor?.edit((builder) => {
                        builder.insert(0, 'HELLO', 'python', vscodeNotebookEnums.CellKind.Code, [], undefined);
                        resolve();
                    })
                );

                // Verify events were fired.
                await waitForCondition(async () => handler.fired, 5_000, 'Change event not fired');
                assert.ok(handler.fired);
                assert.equal(handler.count, 1, 'More than one update fired');
                assert.equal(handler.first.kind, 'insert', 'Incorrect event fired');
                if (handler.first.kind === 'insert') {
                    const expectedCell = createCodeCell(['HELLO'], []);
                    assert.equal(handler.first.index, 0);
                    assert.deepEqual(handler.first.cell.data, expectedCell);
                }

                // Verify model has been updated
                assert.equal(model.cells.length, 2);
            });
        });
    });
});
