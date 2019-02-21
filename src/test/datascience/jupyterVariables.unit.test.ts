// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length
import { nbformat } from '@jupyterlab/coreutils';
import * as assert from 'assert';
import * as typemoq from 'typemoq';
import { IFileSystem } from '../../client/common/platform/types';
import { Identifiers } from '../../client/datascience/constants';
import { JupyterVariables } from '../../client/datascience/jupyter/jupyterVariables';
import { CellState, ICell, INotebookServer, INotebookServerManager } from '../../client/datascience/types';

suite('JupyterVariables', () => {
    let serverManager: typemoq.IMock<INotebookServerManager>;
    let fakeServer: typemoq.IMock<INotebookServer>;
    let jupyterVariables: JupyterVariables;
    let fileSystem: typemoq.IMock<IFileSystem>;

    function generateVariableOutput(outputData: nbformat.IMimeBundle): nbformat.IOutput {
        return {
            output_type: 'execute_result',
            data: outputData
        };
    }

    function generateCell(outputData: nbformat.IMimeBundle, hasOutput: boolean): ICell {
        return {
            data: {
                cell_type: 'code',
                execution_count: 0,
                metadata: {},
                outputs: hasOutput ? [generateVariableOutput(outputData)] : [],
                source: ''
            },
            id: '0',
            file: '',
            line: 0,
            state: CellState.finished
        };
    }

    function generateCells(outputData: nbformat.IMimeBundle, hasOutput: boolean = true): ICell[] {
        return [generateCell(outputData, hasOutput)];
    }

    function createTypeMoq<T>(tag: string): typemoq.IMock<T> {
        // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
        // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
        const result: typemoq.IMock<T> = typemoq.Mock.ofType<T>();
        (result as any)['tag'] = tag;
        result.setup((x: any) => x.then).returns(() => undefined);
        return result;
    }

    setup(() => {
        serverManager = typemoq.Mock.ofType<INotebookServerManager>();
        // Create our fake notebook server
        fakeServer = createTypeMoq<INotebookServer>('Fake Server');

        fileSystem = typemoq.Mock.ofType<IFileSystem>();
        fileSystem.setup(fs => fs.readFile(typemoq.It.isAnyString()))
        .returns(() => Promise.resolve('test'));

        jupyterVariables = new JupyterVariables(fileSystem.object, serverManager.object);
    });

    test('getVariables no server', async() => {
        serverManager.setup(sm => sm.getActiveServer()).returns(() => {
            return undefined;
        });

        fakeServer.setup(fs => fs.execute(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny(), undefined, typemoq.It.isAny()))
        .returns(() => Promise.resolve(generateCells(
            { 'text/plain' : '"[{"name": "big_dataframe", "type": "DataFrame", "size": 62, "expensive": true}, {"name": "big_dict", "type": "dict", "size": 57, "expensive": true}, {"name": "big_list", "type": "list", "size": 57, "expensive": true}, {"name": "big_nparray", "type": "ndarray", "size": 60, "expensive": true}, {"name": "big_string", "type": "str", "size": 59, "expensive": true}, {"name": "getsizeof", "type": "builtin_function_or_method", "size": 58, "expensive": true}, {"name": "json", "type": "module", "size": 53, "expensive": true}, {"name": "notebook", "type": "module", "size": 57, "expensive": true}, {"name": "np", "type": "module", "size": 51, "expensive": true}, {"name": "pd", "type": "module", "size": 51, "expensive": true}, {"name": "plt", "type": "module", "size": 52, "expensive": true}, {"name": "style", "type": "module", "size": 54, "expensive": true}, {"name": "sys", "type": "module", "size": 52, "expensive": true}, {"name": "testing", "type": "str", "size": 56, "expensive": true}, {"name": "textFile", "type": "TextIOWrapper", "size": 57, "expensive": true}, {"name": "value", "type": "int", "size": 66, "expensive": true}]"'}
        )))
        .verifiable(typemoq.Times.never());

        const results = await jupyterVariables.getVariables();
        assert.equal(results.length, 0);

        fakeServer.verifyAll();
    });

    // No cells, no output, no text/plain

    test('getVariables no cells', async() => {
        serverManager.setup(sm => sm.getActiveServer()).returns(() => {
            return fakeServer.object;
        });

        fakeServer.setup(fs => fs.execute(typemoq.It.isValue('test'), typemoq.It.isValue(Identifiers.EmptyFileName), typemoq.It.isValue(0), typemoq.It.isAnyString(), undefined, typemoq.It.isValue(true)))
        .returns(() => Promise.resolve([]))
        .verifiable(typemoq.Times.once());

        let exceptionThrown = false;
        try {
            await jupyterVariables.getVariables();
        } catch (exc) {
            exceptionThrown = true;
        }

        assert.equal(exceptionThrown, true);
        fakeServer.verifyAll();
    });

    test('getVariables no output', async() => {
        serverManager.setup(sm => sm.getActiveServer()).returns(() => {
            return fakeServer.object;
        });

        fakeServer.setup(fs => fs.execute(typemoq.It.isValue('test'), typemoq.It.isValue(Identifiers.EmptyFileName), typemoq.It.isValue(0), typemoq.It.isAnyString(), undefined, typemoq.It.isValue(true)))
        .returns(() => Promise.resolve(generateCells({}, false)))
        .verifiable(typemoq.Times.once());

        let exceptionThrown = false;
        try {
            await jupyterVariables.getVariables();
        } catch (exc) {
            exceptionThrown = true;
        }

        assert.equal(exceptionThrown, true);
        fakeServer.verifyAll();
    });

    test('getVariables bad mime', async() => {
        serverManager.setup(sm => sm.getActiveServer()).returns(() => {
            return fakeServer.object;
        });

        fakeServer.setup(fs => fs.execute(typemoq.It.isValue('test'), typemoq.It.isValue(Identifiers.EmptyFileName), typemoq.It.isValue(0), typemoq.It.isAnyString(), undefined, typemoq.It.isValue(true)))
        .returns(() => Promise.resolve(generateCells(
            { 'text/html' : '' }
        )))
        .verifiable(typemoq.Times.once());

        let exceptionThrown = false;
        try {
            await jupyterVariables.getVariables();
        } catch (exc) {
            exceptionThrown = true;
        }

        assert.equal(exceptionThrown, true);
        fakeServer.verifyAll();
    });

    test('getVariables fake data', async() => {
        serverManager.setup(sm => sm.getActiveServer()).returns(() => {
            return fakeServer.object;
        });

        fakeServer.setup(fs => fs.execute(typemoq.It.isValue('test'), typemoq.It.isValue(Identifiers.EmptyFileName), typemoq.It.isValue(0), typemoq.It.isAnyString(), undefined, typemoq.It.isValue(true)))
        .returns(() => Promise.resolve(generateCells(
            { 'text/plain' : '"[{"name": "big_dataframe", "type": "DataFrame", "size": 62, "expensive": true}, {"name": "big_dict", "type": "dict", "size": 57, "expensive": true}, {"name": "big_list", "type": "list", "size": 57, "expensive": true}, {"name": "big_nparray", "type": "ndarray", "size": 60, "expensive": true}, {"name": "big_string", "type": "str", "size": 59, "expensive": true}, {"name": "getsizeof", "type": "builtin_function_or_method", "size": 58, "expensive": true}, {"name": "json", "type": "module", "size": 53, "expensive": true}, {"name": "notebook", "type": "module", "size": 57, "expensive": true}, {"name": "np", "type": "module", "size": 51, "expensive": true}, {"name": "pd", "type": "module", "size": 51, "expensive": true}, {"name": "plt", "type": "module", "size": 52, "expensive": true}, {"name": "style", "type": "module", "size": 54, "expensive": true}, {"name": "sys", "type": "module", "size": 52, "expensive": true}, {"name": "testing", "type": "str", "size": 56, "expensive": true}, {"name": "textFile", "type": "TextIOWrapper", "size": 57, "expensive": true}, {"name": "value", "type": "int", "size": 66, "expensive": true}]"'}
        )))
        .verifiable(typemoq.Times.once());

        const results = await jupyterVariables.getVariables();

        // Check the results that we get back
        assert.equal(results.length, 16);

        // Check our items (just the first few real items, no need to check all 19)
        assert.deepEqual(results[0], {name: 'big_dataframe', size: 62, type: 'DataFrame', expensive: true});
        assert.deepEqual(results[1], {name: 'big_dict', size: 57, type: 'dict', expensive: true});
        assert.deepEqual(results[2], {name: 'big_list', size: 57, type: 'list', expensive: true});
        assert.deepEqual(results[3], {name: 'big_nparray', size: 60, type: 'ndarray', expensive: true});
        assert.deepEqual(results[4], {name: 'big_string', size: 59, type: 'str', expensive: true});
        assert.deepEqual(results[5], {name: 'getsizeof', size: 58, type: 'builtin_function_or_method', expensive: true});

        fakeServer.verifyAll();
    });
});
