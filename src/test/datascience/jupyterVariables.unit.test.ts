// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import * as assert from 'assert';
import * as typemoq from 'typemoq';

import { PythonSettings } from '../../client/common/configSettings';
import { IFileSystem } from '../../client/common/platform/types';
import { IConfigurationService } from '../../client/common/types';
import { Identifiers } from '../../client/datascience/constants';
import { JupyterVariables } from '../../client/datascience/jupyter/jupyterVariables';
import { CellState, ICell, IJupyterVariable, INotebook } from '../../client/datascience/types';
import { MockAutoSelectionService } from '../mocks/autoSelector';

// tslint:disable:no-any max-func-body-length
suite('JupyterVariables', () => {
    let fakeNotebook: typemoq.IMock<INotebook>;
    let jupyterVariables: JupyterVariables;
    let fileSystem: typemoq.IMock<IFileSystem>;
    const pythonSettings = new (class extends PythonSettings {
        public fireChangeEvent() {
            this.changed.fire();
        }
    })(undefined, new MockAutoSelectionService());

    function generateVariableOutput(outputData: string, outputType: string): nbformat.IOutput {
        switch (outputType) {
            case 'execute_result':
                return {
                    output_type: outputType,
                    data: {
                        'text/plain': outputData,
                    },
                };
            default:
                return {
                    output_type: outputType,
                    text: outputData,
                };
        }
    }

    function generateCell(outputData: string, outputType: string, hasOutput: boolean): ICell {
        return {
            data: {
                cell_type: 'code',
                execution_count: 0,
                metadata: {},
                outputs: hasOutput ? [generateVariableOutput(outputData, outputType)] : [],
                source: '',
            },
            id: '0',
            file: '',
            line: 0,
            state: CellState.finished,
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
        // Setup default settings
        pythonSettings.datascience = {
            allowImportFromNotebook: true,
            jupyterLaunchTimeout: 20000,
            jupyterLaunchRetries: 3,
            enabled: true,
            jupyterServerURI: 'local',
            notebookFileRoot: 'WORKSPACE',
            changeDirOnImportExport: true,
            useDefaultConfigForJupyter: true,
            jupyterInterruptTimeout: 10000,
            searchForJupyter: true,
            showCellInputCode: true,
            collapseCellInputCodeByDefault: true,
            allowInput: true,
            maxOutputSize: 400,
            errorBackgroundColor: '#FFFFFF',
            sendSelectionToInteractiveWindow: false,
            variableExplorerExclude: 'module;function;builtin_function_or_method',
            codeRegularExpression: '^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])',
            markdownRegularExpression: '^(#\\s*%%\\s*\\[markdown\\]|#\\s*\\<markdowncell\\>)',
            enableCellCodeLens: true,
            enablePlotViewer: true,
            runStartupCommands: '',
            debugJustMyCode: true,
            variableQueries: [],
            jupyterCommandLineArguments: [],
        };

        // Create our fake notebook
        fakeNotebook = createTypeMoq<INotebook>('Fake Notebook');
        const config = createTypeMoq<IConfigurationService>('Config ');

        fileSystem = typemoq.Mock.ofType<IFileSystem>();
        fileSystem.setup((fs) => fs.readFile(typemoq.It.isAnyString())).returns(() => Promise.resolve('test'));
        config.setup((s) => s.getSettings(typemoq.It.isAny())).returns(() => pythonSettings);

        jupyterVariables = new JupyterVariables(fileSystem.object, config.object);
    });

    // No cells, no output, no text/plain
    test('getVariables no cells', async () => {
        fakeNotebook
            .setup((fs) =>
                fs.execute(
                    typemoq.It.isAny(),
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
            await jupyterVariables.getVariables(fakeNotebook.object, {
                startIndex: 0,
                pageSize: 100,
                sortColumn: '',
                sortAscending: true,
                executionCount: 1,
            });
        } catch (exc) {
            exceptionThrown = true;
        }

        assert.equal(exceptionThrown, true);
        fakeNotebook.verifyAll();
    });

    test('getVariables no output', async () => {
        fakeNotebook
            .setup((fs) =>
                fs.execute(
                    typemoq.It.isAny(),
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
            await jupyterVariables.getVariables(fakeNotebook.object, {
                startIndex: 0,
                pageSize: 100,
                sortColumn: '',
                sortAscending: true,
                executionCount: 1,
            });
        } catch (exc) {
            exceptionThrown = true;
        }

        assert.equal(exceptionThrown, true);
        fakeNotebook.verifyAll();
    });

    test('getVariables bad output type', async () => {
        fakeNotebook
            .setup((fs) =>
                fs.execute(
                    typemoq.It.isAny(),
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
            await jupyterVariables.getVariables(fakeNotebook.object, {
                startIndex: 0,
                pageSize: 100,
                sortColumn: '',
                sortAscending: true,
                executionCount: 1,
            });
        } catch (exc) {
            exceptionThrown = true;
        }

        assert.equal(exceptionThrown, true);
        fakeNotebook.verifyAll();
    });

    test('getVariables fake data', async () => {
        fakeNotebook
            .setup((fs) =>
                fs.execute(
                    typemoq.It.isAny(),
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
                        `['big_dataframe', 'big_dict', 'big_int', 'big_list', 'big_nparray', 'big_string']`,
                        'execute_result'
                    )
                )
            )
            .verifiable(typemoq.Times.once());
        fakeNotebook
            .setup((fs) => fs.inspect(typemoq.It.isAny()))
            .returns(() =>
                Promise.resolve({
                    'text/plain': `\u001b[1;31mType:\u001b[0m        complex
\u001b[1;31mString form:\u001b[0m (1+1j)
\u001b[1;31mDocstring:\u001b[0m  
Create a complex number from a real part and an optional imaginary part.
                        
This is equivalent to (real + imag*1j) where imag defaults to 0.
                        "`,
                })
            );

        const results = await jupyterVariables.getVariables(fakeNotebook.object, {
            startIndex: 0,
            pageSize: 100,
            sortColumn: '',
            sortAscending: true,
            executionCount: 1,
        });

        // Check the results that we get back
        assert.equal(results.pageResponse.length, 6);

        // Check our items (just the first few real items, no need to check all 19)
        assert.equal(results.pageResponse[0].name, 'big_dataframe');
        assert.equal(results.pageResponse[1].name, 'big_dict');
        assert.equal(results.pageResponse[2].name, 'big_int');
        assert.equal(results.pageResponse[3].name, 'big_list');
        assert.equal(results.pageResponse[4].name, 'big_nparray');
        assert.equal(results.pageResponse[5].name, 'big_string');

        fakeNotebook.verifyAll();
    });

    // getValue failure paths are shared with getVariables, so no need to test them here
    test('getValue fake data', async () => {
        fakeNotebook
            .setup((fs) =>
                fs.execute(
                    typemoq.It.isAny(),
                    typemoq.It.isValue(Identifiers.EmptyFileName),
                    typemoq.It.isValue(0),
                    typemoq.It.isAnyString(),
                    undefined,
                    typemoq.It.isValue(true)
                )
            )
            .returns(() => Promise.resolve(generateCells(`['big_complex']`, 'execute_result')))
            .verifiable(typemoq.Times.once());
        fakeNotebook
            .setup((fs) => fs.inspect(typemoq.It.isValue('big_complex')))
            .returns(() =>
                Promise.resolve({
                    'text/plain': `\u001b[1;31mType:\u001b[0m        complex
\u001b[1;31mString form:\u001b[0m (1+1j)
\u001b[1;31mDocstring:\u001b[0m  
Create a complex number from a real part and an optional imaginary part.
                        
This is equivalent to (real + imag*1j) where imag defaults to 0.
                        "`,
                })
            )
            .verifiable(typemoq.Times.once());

        const testVariable: IJupyterVariable = {
            name: 'big_complex',
            type: 'complex',
            size: 0,
            truncated: true,
            count: 0,
            shape: '',
            value: ' (1+1j)',
            supportsDataExplorer: false,
        };

        const results = await jupyterVariables.getVariables(fakeNotebook.object, {
            startIndex: 0,
            pageSize: 100,
            sortColumn: '',
            sortAscending: true,
            executionCount: 1,
        });
        const resultVariable = results.pageResponse[0];

        // Verify the result value should be filled out from fake server result
        assert.deepEqual(resultVariable, testVariable);
        fakeNotebook.verifyAll();
    });
});
