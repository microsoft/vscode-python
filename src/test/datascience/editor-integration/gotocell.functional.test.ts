// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import { ChildProcess } from 'child_process';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { CodeLens, Disposable, Position, Range, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';

import { IDocumentManager } from '../../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { traceError } from '../../../client/common/logger';
import { Commands, Identifiers } from '../../../client/datascience/constants';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import {
    ICell,
    ICodeLensFactory,
    IDataScienceCodeLensProvider,
    IInteractiveWindowListener,
    IJupyterExecution,
    INotebook
} from '../../../client/datascience/types';
import { DataScienceIocContainer } from '../dataScienceIocContainer';
import { MockDocumentManager } from '../mockDocumentManager';

// tslint:disable:no-any no-multiline-string max-func-body-length no-console max-classes-per-file trailing-comma
suite('DataScience gotocell tests', () => {
    const disposables: Disposable[] = [];
    let codeLensProvider: IDataScienceCodeLensProvider;
    let codeLensFactory: ICodeLensFactory;
    let jupyterExecution: IJupyterExecution;
    let ioc: DataScienceIocContainer;
    let documentManager: MockDocumentManager;
    let visibleCells: ICell[] = [];

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        codeLensProvider = ioc.serviceManager.get<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider);
        jupyterExecution = ioc.serviceManager.get<IJupyterExecution>(IJupyterExecution);
        documentManager = ioc.serviceManager.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
        codeLensFactory = ioc.serviceManager.get<ICodeLensFactory>(ICodeLensFactory);
    });

    teardown(async () => {
        try {
            // tslint:disable-next-line:prefer-for-of
            for (let i = 0; i < disposables.length; i += 1) {
                const disposable = disposables[i];
                if (disposable) {
                    const promise = disposable.dispose() as Promise<any>;
                    if (promise) {
                        await promise;
                    }
                }
            }
            await ioc.dispose();
        } catch (e) {
            traceError(e);
        }
        visibleCells = [];
    });

    function runTest(name: string, func: () => Promise<void>, _notebookProc?: ChildProcess) {
        test(name, async () => {
            console.log(`Starting test ${name} ...`);
            if (await jupyterExecution.isNotebookSupported()) {
                return func();
            } else {
                // tslint:disable-next-line:no-console
                console.log(`Skipping test ${name}, no jupyter installed.`);
            }
        });
    }

    async function createNotebook(
        useDefaultConfig: boolean,
        expectFailure?: boolean,
        usingDarkTheme?: boolean,
        purpose?: string
    ): Promise<INotebook | undefined> {
        // Catch exceptions. Throw a specific assertion if the promise fails
        try {
            const testDir = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');
            const server = await jupyterExecution.connectToNotebookServer({
                usingDarkTheme,
                useDefaultConfig,
                workingDir: testDir,
                purpose: purpose ? purpose : '1'
            });
            if (expectFailure) {
                assert.ok(false, `Expected server to not be created`);
            }
            return server
                ? await server.createNotebook(undefined, Uri.parse(Identifiers.InteractiveWindowIdentity))
                : undefined;
        } catch (exc) {
            if (!expectFailure) {
                assert.ok(false, `Expected server to be created, but got ${exc}`);
            }
        }
    }

    function addMockData(code: string, result: string | number, mimeType?: string, cellType?: string) {
        if (ioc.mockJupyter) {
            if (cellType && cellType === 'error') {
                ioc.mockJupyter.addError(code, result.toString());
            } else {
                ioc.mockJupyter.addCell(code, result, mimeType);
            }
        }
    }

    function addDocument(cells: { code: string; result: any; cellType?: string }[], filePath: string) {
        let docText = '';
        cells.forEach(c => {
            addMockData(c.code, c.result, c.cellType);
            docText = docText.concat(c.code, '\n');
        });
        documentManager.addDocument(docText, filePath);
    }

    function srcDirectory() {
        return path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');
    }

    function getCodeLenses(): CodeLens[] {
        const doc = documentManager.textDocuments[0];
        const result = codeLensProvider.provideCodeLenses(doc, CancellationToken.None);
        if ((result as any).length) {
            return result as CodeLens[];
        }
        return [];
    }

    async function executeCell(pos: number, notebook: INotebook): Promise<number> {
        // Not using the interactive window, so we need to execute directly.
        const doc = documentManager.textDocuments[0];

        // However use the code lens to figure out the code to execute
        const codeLenses = getCodeLenses();
        assert.ok(codeLenses && codeLenses.length > 0, 'No cell code lenses found');
        if (codeLenses.length) {
            const runLens = codeLenses.filter(c => c.command && c.command.command === Commands.RunCell);
            assert.ok(runLens && runLens.length > pos, 'No run cell code lenses found');
            const codeLens = runLens[pos];
            const code = doc.getText(codeLens.range);
            const startLine = codeLens.range.start.line;
            const output = await notebook.execute(code, doc.fileName, startLine, uuid());
            visibleCells = visibleCells.concat(output);
            // Trick the codeLensFactory into having the cells
            const listener = (codeLensFactory as any) as IInteractiveWindowListener;
            listener.onMessage(InteractiveWindowMessages.FinishCell, output[0]);
        }

        return visibleCells.length;
    }

    function verifyNoGoto(startLine: number) {
        // See what code lens we have for the document
        const codeLenses = getCodeLenses();

        // There should be one with the ScrollTo command
        const scrollTo = codeLenses.find(
            c => c.command && c.command.command === Commands.ScrollToCell && c.range.start.line === startLine
        );
        assert.equal(scrollTo, undefined, 'Goto cell code lens should not be found');
    }

    function verifyGoto(count: string, startLine: number) {
        // See what code lens we have for the document
        const codeLenses = getCodeLenses();

        // There should be one with the ScrollTo command
        const scrollTo = codeLenses.find(
            c => c.command && c.command.command === Commands.ScrollToCell && c.range.start.line === startLine
        );
        assert.ok(scrollTo, 'Goto cell code lens not found');

        // It should have the same number as the execution count
        assert.ok(scrollTo!.command!.title.includes(count), 'Wrong goto on cell');
    }

    function addSingleChange(range: Range, newText: string) {
        const filePath = path.join(srcDirectory(), 'foo.py');
        documentManager.changeDocument(filePath, [{ range, newText }]);
    }

    runTest('Basic execution', async () => {
        addDocument(
            [
                {
                    code: `#%%\na=1\na`,
                    result: 1
                },
                {
                    code: `#%%\na+=1\na`,
                    result: 2
                },
                {
                    code: `#%%\na+=4\na`,
                    result: 6
                }
            ],
            path.join(srcDirectory(), 'foo.py')
        );

        const server = await createNotebook(true);
        assert.ok(server, 'No server created');

        // Verify we don't have a goto
        const codeLenses = getCodeLenses();
        const scrollTo = codeLenses.find(c => c.command && c.command.command === Commands.ScrollToCell);
        assert.equal(scrollTo, undefined, 'Goto cell code lens should not be found');

        // Execute the first cell
        await executeCell(0, server!);

        // Verify it now has a goto
        verifyGoto('1', 0);
    });

    runTest('Basic edit', async () => {
        const filePath = path.join(srcDirectory(), 'foo.py');
        addDocument(
            [
                {
                    code: `#%%\na=1\na`,
                    result: 1
                },
                {
                    code: `#%%\na+=1\na`,
                    result: 2
                },
                {
                    code: `#%%\na+=4\na`,
                    result: 6
                },
                {
                    code: `#%%\n`,
                    result: undefined
                }
            ],
            filePath
        );

        const server = await createNotebook(true);
        assert.ok(server, 'No server created');

        // Execute the second cell
        await executeCell(1, server!);

        // verify we have an execute
        verifyGoto('1', 3);

        // Execute the first cell and check same thing
        await executeCell(0, server!);

        // verify we have an execute
        verifyGoto('2', 0);

        // Delete the first cell and make sure the second cell still has an execute
        addSingleChange(new Range(new Position(0, 0), new Position(3, 0)), '');

        // verify we have an execute (start should have moved though)
        verifyGoto('1', 0);

        // Run the last cell. It should not generate a code lens as it has no code
        await executeCell(2, server!);
        verifyNoGoto(6);

        // Put back the cell we deleted
        addSingleChange(new Range(new Position(0, 0), new Position(0, 0)), '#%%\na=1\na\n');

        // Our 2nd execute should show up again
        verifyGoto('2', 0);

        // Our 1st execute should have moved
        verifyGoto('1', 3);
    });
});
