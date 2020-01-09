// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import * as assert from 'assert';
import * as typemoq from 'typemoq';

import { IFileSystem } from '../../client/common/platform/types';
import { Identifiers } from '../../client/datascience/constants';
import { JupyterVariables } from '../../client/datascience/jupyter/jupyterVariables';
import { CellState, ICell, IJupyterVariable, INotebook } from '../../client/datascience/types';

// tslint:disable:no-any max-func-body-length
suite('JupyterVariables', () => {
    let fakeNotebook: typemoq.IMock<INotebook>;
    let jupyterVariables: JupyterVariables;
    let fileSystem: typemoq.IMock<IFileSystem>;

    function generateVariableOutput(outputData: string, outputType: string): nbformat.IOutput {
        return {
            output_type: outputType,
            text: outputData
        };
    }

    function generateCell(outputData: string, outputType: string, hasOutput: boolean): ICell {
        return {
            data: {
                cell_type: 'code',
                execution_count: 0,
                metadata: {},
                outputs: hasOutput ? [generateVariableOutput(outputData, outputType)] : [],
                source: ''
            },
            id: '0',
            file: '',
            line: 0,
            state: CellState.finished
        };
    }

    function generateCells(outputData: string, outputType: string, hasOutput: boolean = true): ICell[] {
        return [generateCell(outputData, outputType, hasOutput)];
    }

    function createTypeMoq<T>(tag: string): typemoq.IMock<T> {
        // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
        // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
        const result: typemoq.IMock<T> = typemoq.Mock.ofType<T>();
        (result as any).tag = tag;
        result.setup((x: any) => x.then).returns(() => undefined);
        return result;
    }

    setup(() => {
        // Create our fake notebook
        fakeNotebook = createTypeMoq<INotebook>('Fake Notebook');

        fileSystem = typemoq.Mock.ofType<IFileSystem>();
        fileSystem.setup(fs => fs.readFile(typemoq.It.isAnyString())).returns(() => Promise.resolve('test'));

        jupyterVariables = new JupyterVariables(fileSystem.object);
    });

    // No cells, no output, no text/plain
    test('getVariables no cells', async () => {
        fakeNotebook
            .setup(fs =>
                fs.execute(
                    typemoq.It.isValue('test'),
                    typemoq.It.isValue(Identifiers.EmptyFileName),
                    typemoq.It.isValue(0),
                    typemoq.It.isAnyString(),
                    undefined,
                    typemoq.It.isValue(true)
                )
            )
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.once());

        let exceptionThrown = false;
        try {
            await jupyterVariables.getVariables(fakeNotebook.object);
        } catch (exc) {
            exceptionThrown = true;
        }

        assert.equal(exceptionThrown, true);
        fakeNotebook.verifyAll();
    });

    test('getVariables no output', async () => {
        fakeNotebook
            .setup(fs =>
                fs.execute(
                    typemoq.It.isValue('test'),
                    typemoq.It.isValue(Identifiers.EmptyFileName),
                    typemoq.It.isValue(0),
                    typemoq.It.isAnyString(),
                    undefined,
                    typemoq.It.isValue(true)
                )
            )
            .returns(() => Promise.resolve(generateCells('', 'stream', false)))
            .verifiable(typemoq.Times.once());

        let exceptionThrown = false;
        try {
            await jupyterVariables.getVariables(fakeNotebook.object);
        } catch (exc) {
            exceptionThrown = true;
        }

        assert.equal(exceptionThrown, true);
        fakeNotebook.verifyAll();
    });

    test('getVariables bad output type', async () => {
        fakeNotebook
            .setup(fs =>
                fs.execute(
                    typemoq.It.isValue('test'),
                    typemoq.It.isValue(Identifiers.EmptyFileName),
                    typemoq.It.isValue(0),
                    typemoq.It.isAnyString(),
                    undefined,
                    typemoq.It.isValue(true)
                )
            )
            .returns(() => Promise.resolve(generateCells('bogus string', 'bogus output type')))
            .verifiable(typemoq.Times.once());

        let exceptionThrown = false;
        try {
            await jupyterVariables.getVariables(fakeNotebook.object);
        } catch (exc) {
            exceptionThrown = true;
        }

        assert.equal(exceptionThrown, true);
        fakeNotebook.verifyAll();
    });

    test('getVariables fake data', async () => {
        fakeNotebook
            .setup(fs =>
                fs.execute(
                    typemoq.It.isValue('test'),
                    typemoq.It.isValue(Identifiers.EmptyFileName),
                    typemoq.It.isValue(0),
                    typemoq.It.isAnyString(),
                    undefined,
                    typemoq.It.isValue(true)
                )
            )
            .returns(() =>
                Promise.resolve(
                    generateCells(
                        '[{"name": "big_dataframe", "type": "DataFrame", "size": 62}, {"name": "big_dict", "type": "dict", "size": 57}, {"name": "big_int", "type": "int", "size": 56}, {"name": "big_list", "type": "list", "size": 57}, {"name": "big_nparray", "type": "ndarray", "size": 60}, {"name": "big_string", "type": "str", "size": 59}]',
                        'stream'
                    )
                )
            )
            .verifiable(typemoq.Times.once());

        const results = await jupyterVariables.getVariables(fakeNotebook.object);

        // Check the results that we get back
        assert.equal(results.length, 6);

        // Check our items (just the first few real items, no need to check all 19)
        assert.deepEqual(results[0], { name: 'big_dataframe', size: 62, type: 'DataFrame' });
        assert.deepEqual(results[1], { name: 'big_dict', size: 57, type: 'dict' });
        assert.deepEqual(results[2], { name: 'big_int', size: 56, type: 'int' });
        assert.deepEqual(results[3], { name: 'big_list', size: 57, type: 'list' });
        assert.deepEqual(results[4], { name: 'big_nparray', size: 60, type: 'ndarray' });
        assert.deepEqual(results[5], { name: 'big_string', size: 59, type: 'str' });

        fakeNotebook.verifyAll();
    });

    // getValue failure paths are shared with getVariables, so no need to test them here
    test('getValue fake data', async () => {
        fakeNotebook
            .setup(fs =>
                fs.execute(
                    typemoq.It.isValue('test'),
                    typemoq.It.isValue(Identifiers.EmptyFileName),
                    typemoq.It.isValue(0),
                    typemoq.It.isAnyString(),
                    undefined,
                    typemoq.It.isValue(true)
                )
            )
            .returns(() => Promise.resolve(generateCells('{"name": "big_complex", "type": "complex", "size": 60, "value": "(1+1j)"}', 'stream')))
            .verifiable(typemoq.Times.once());

        const testVariable: IJupyterVariable = { name: 'big_complex', type: 'complex', size: 60, truncated: false, count: 0, shape: '', value: '', supportsDataExplorer: false };

        const resultVariable = await jupyterVariables.getValue(testVariable, fakeNotebook.object);

        // Verify the result value should be filled out from fake server result
        assert.deepEqual(resultVariable, { name: 'big_complex', size: 60, type: 'complex', value: '(1+1j)' });
        fakeNotebook.verifyAll();
    });
});
