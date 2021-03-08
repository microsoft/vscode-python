// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';
import { PYTHON_LANGUAGE } from '../../client/common/constants';
import { updateSetting } from '../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../constants';
import { sleep } from '../core';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { openFileAndWaitForLS, openNotebookAndWaitForLS } from '../smoke/common';

const fileDefinitions = path.join(
    EXTENSION_ROOT_DIR_FOR_TESTS,
    'src',
    'testMultiRootWkspc',
    'smokeTests',
    'definitions.py',
);

const notebookDefinitions = path.join(
    EXTENSION_ROOT_DIR_FOR_TESTS,
    'src',
    'testMultiRootWkspc',
    'smokeTests',
    'definitions.ipynb',
);

suite('Insiders Test: Language Server', () => {
    suiteSetup(async function () {
        // This test should only run in the insiders build
        if (vscode.env.appName.includes('Insider')) {
            await updateSetting(
                'linting.ignorePatterns',
                ['**/dir1/**'],
                vscode.workspace.workspaceFolders![0].uri,
                vscode.ConfigurationTarget.WorkspaceFolder,
            );
            await initialize();
        } else {
            this.skip();
        }
    });
    setup(async () => {
        await initializeTest();
        await closeActiveWindows();
    });
    suiteTeardown(async () => {
        await closeActiveWindows();
        await updateSetting(
            'linting.ignorePatterns',
            undefined,
            vscode.workspace.workspaceFolders![0].uri,
            vscode.ConfigurationTarget.WorkspaceFolder,
        );
    });
    teardown(closeActiveWindows);

    test('Definitions', async () => {
        const startPosition = new vscode.Position(13, 6);
        const textDocument = await openFileAndWaitForLS(fileDefinitions);
        let tested = false;
        for (let i = 0; i < 5; i += 1) {
            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                textDocument.uri,
                startPosition,
            );
            if (locations && locations.length > 0) {
                expect(locations![0].uri.fsPath).to.contain(path.basename(fileDefinitions));
                tested = true;
                break;
            } else {
                // Wait for LS to start.
                await sleep(5_000);
            }
        }
        if (!tested) {
            assert.fail('Failed to test definitions');
        }
    });
    test('Notebooks', async () => {
        const startPosition = new vscode.Position(0, 6);
        const notebookDocument = await openNotebookAndWaitForLS(notebookDefinitions);
        let tested = false;
        for (let i = 0; i < 5; i += 1) {
            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                notebookDocument.cells[2].uri, // Second cell should have a function with the decorator on it
                startPosition,
            );
            if (locations && locations.length > 0) {
                expect(locations![0].uri.fsPath).to.contain(path.basename(notebookDefinitions));

                // Insert a new cell
                const activeEditor = vscode.window.activeNotebookEditor;
                expect(activeEditor).not.to.be.equal(undefined, 'Active editor not found in notebook');
                await activeEditor!.edit((edit) => {
                    edit.replaceCells(0, 0, [
                        new vscode.NotebookCellData(
                            vscode.NotebookCellKind.Code,
                            PYTHON_LANGUAGE,
                            'x = 4',
                            [],
                            new vscode.NotebookCellMetadata().with({
                                hasExecutionOrder: false,
                            }),
                        ),
                    ]);
                });

                // Wait a bit to get diagnostics
                await sleep(1_000);

                // Make sure no error diagnostics
                let diagnostics = vscode.languages.getDiagnostics(activeEditor!.document.uri);
                expect(diagnostics).to.have.lengthOf(0, 'Diagnostics found when shouldnt be');

                // Move the cell
                await activeEditor!.edit((edit) => {
                    edit.replaceCells(0, 1, []);
                    edit.replaceCells(1, 0, [
                        new vscode.NotebookCellData(
                            vscode.NotebookCellKind.Code,
                            PYTHON_LANGUAGE,
                            'x = 4',
                            [],
                            new vscode.NotebookCellMetadata().with({
                                hasExecutionOrder: false,
                            }),
                        ),
                    ]);
                });

                // Wait a bit to get diagnostics
                await sleep(1_000);

                // Make sure no error diagnostics
                diagnostics = vscode.languages.getDiagnostics(activeEditor!.document.uri);
                expect(diagnostics).to.have.lengthOf(0, 'Diagnostics found when shouldnt be after move');

                // Delete the cell
                await activeEditor!.edit((edit) => {
                    edit.replaceCells(1, 1, []);
                });

                // Wait a bit to get diagnostics
                await sleep(1_000);

                // Make sure no error diagnostics
                diagnostics = vscode.languages.getDiagnostics(activeEditor!.document.uri);
                expect(diagnostics).to.have.lengthOf(0, 'Diagnostics found when shouldnt be after delete');
                tested = true;

                break;
            } else {
                // Wait for LS to start.
                await sleep(5_000);
            }
        }
        if (!tested) {
            assert.fail('Failled to test notebooks');
        }
    });
});
