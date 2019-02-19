// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length
import { nbformat } from '@jupyterlab/coreutils';
import * as assert from 'assert';
import * as typemoq from 'typemoq';
import { Identifiers } from '../../client/datascience/constants';
import { JupyterVariables } from '../../client/datascience/jupyter/jupyterVariables';
import { CellState, ICell, IJupyterVariable, INotebookServer, INotebookServerManager } from '../../client/datascience/types';

suite('JupyterVariables', () => {
    let serverManager: typemoq.IMock<INotebookServerManager>;
    let fakeServer: typemoq.IMock<INotebookServer>;
    let jupyterVariables: JupyterVariables;

    function generateVariableOutput(): nbformat.IOutput {
        return {
            output_type: 'execute_result',
            data: { 'text/plain' : '"[{"name": "big_dataframe", "type": "DataFrame", "size": 62, "expensive": true}, {"name": "big_dict", "type": "dict", "size": 57, "expensive": true}, {"name": "big_list", "type": "list", "size": 57, "expensive": true}, {"name": "big_nparray", "type": "ndarray", "size": 60, "expensive": true}, {"name": "big_string", "type": "str", "size": 59, "expensive": true}, {"name": "getsizeof", "type": "builtin_function_or_method", "size": 58, "expensive": true}, {"name": "json", "type": "module", "size": 53, "expensive": true}, {"name": "notebook", "type": "module", "size": 57, "expensive": true}, {"name": "np", "type": "module", "size": 51, "expensive": true}, {"name": "pd", "type": "module", "size": 51, "expensive": true}, {"name": "plt", "type": "module", "size": 52, "expensive": true}, {"name": "style", "type": "module", "size": 54, "expensive": true}, {"name": "sys", "type": "module", "size": 52, "expensive": true}, {"name": "testing", "type": "str", "size": 56, "expensive": true}, {"name": "textFile", "type": "TextIOWrapper", "size": 57, "expensive": true}, {"name": "value", "type": "int", "size": 66, "expensive": true}]"'}
        };
    }

    function generateCell(): ICell {
        return {
            data: {
                cell_type: 'code',
                execution_count: 0,
                metadata: {},
                outputs: [generateVariableOutput()],
                source: ''
            },
            id: '0',
            file: '',
            line: 0,
            state: CellState.finished
        };
    }

    function generateCells(): ICell[] {
        return [generateCell()];
    }

    function createTypeMoq<T>(tag: string): typemoq.IMock<T> {
        // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
        // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
        const result: typemoq.IMock<T> = typemoq.Mock.ofType<T>();
        (result as any)['tag'] = tag;
        result.setup((x: any) => x.then).returns(() => undefined);
        return result;
    }

    function verifyVariable(variable: IJupyterVariable, expensive: boolean, name: string, size: number, type: string) {
        assert.equal(variable.expensive, expensive);
        assert.equal(variable.name, name);
        assert.equal(variable.size, size);
        assert.equal(variable.type, type);
    }

    setup(() => {
        serverManager = typemoq.Mock.ofType<INotebookServerManager>();
        // Create our fake notebook server
        fakeServer = createTypeMoq<INotebookServer>('Fake Server');

        jupyterVariables = new JupyterVariables(serverManager.object);
    });

    test('getVariables no server', async() => {
        serverManager.setup(sm => sm.getActiveServer()).returns(() => {
            return undefined;
        });

        fakeServer.setup(fs => fs.execute(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny(), undefined, typemoq.It.isAny())).returns(() => {
            return Promise.resolve(generateCells());
        }).verifiable(typemoq.Times.never());

        const results = await jupyterVariables.getVariables();
        assert.equal(results.length, 0);

        fakeServer.verifyAll();
    });

    test('getVariables fake data', async() => {
        serverManager.setup(sm => sm.getActiveServer()).returns(() => {
            return fakeServer.object;
        });

        fakeServer.setup(fs => fs.execute(typemoq.It.isAnyString(), typemoq.It.isValue(Identifiers.EmptyFileName), typemoq.It.isValue(0), typemoq.It.isAnyString(), undefined, typemoq.It.isValue(true))).returns(() => {
            return Promise.resolve(generateCells());
        }).verifiable(typemoq.Times.once());

        const results = await jupyterVariables.getVariables();

        // Check the results that we get back
        assert.equal(results.length, 16);

        // Check our items (just the first few real items, no need to check all 19)
        verifyVariable(results[0], true, 'big_dataframe', 62, 'DataFrame');
        verifyVariable(results[1], true, 'big_dict', 57, 'dict');
        verifyVariable(results[2], true, 'big_list', 57, 'list');
        verifyVariable(results[3], true, 'big_nparray', 60, 'ndarray');
        verifyVariable(results[4], true, 'big_string', 59, 'str');
        verifyVariable(results[5], true, 'getsizeof', 58, 'builtin_function_or_method');

        fakeServer.verifyAll();
    });
});
