// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';
import * as AdazzleReactDataGrid from 'react-data-grid';
import { Disposable } from 'vscode';

import { RunByLine } from '../../client/common/experimentGroups';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterVariable } from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { takeSnapshot, writeDiffSnapshot } from './helpers';
import { addCode, getOrCreateInteractiveWindow } from './interactiveWindowTestHelpers';
import { addCell, createNewEditor } from './nativeEditorTestHelpers';
import {
    openVariableExplorer,
    runDoubleTest,
    runInteractiveTest,
    waitForMessage,
    waitForVariablesUpdated
} from './testHelpers';
import { verifyAfterStep, verifyCanFetchData, verifyVariables } from './variableTestHelpers';

// tslint:disable: no-var-requires no-require-imports
const rangeInclusive = require('range-inclusive');

// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
[false, true].forEach((runByLine) => {
    suite(`DataScience Interactive Window variable explorer tests with RunByLine set to ${runByLine}`, () => {
        const disposables: Disposable[] = [];
        let ioc: DataScienceIocContainer;
        let createdNotebook = false;
        let snapshot: any;

        suiteSetup(function () {
            snapshot = takeSnapshot();
            // These test require python, so only run with a non-mocked jupyter
            const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;
            if (!isRollingBuild) {
                // tslint:disable-next-line:no-console
                console.log('Skipping Variable Explorer tests. Requires python environment');
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
        });

        setup(async () => {
            ioc = new DataScienceIocContainer();
            ioc.setExperimentState(RunByLine.experiment, runByLine);
            ioc.registerDataScienceTypes();
            createdNotebook = false;
            await ioc.activate();
        });

        teardown(async () => {
            for (const disposable of disposables) {
                if (!disposable) {
                    continue;
                }
                // tslint:disable-next-line:no-any
                const promise = disposable.dispose() as Promise<any>;
                if (promise) {
                    await promise;
                }
            }
            await ioc.dispose();
        });

        // Uncomment this to debug hangs on exit
        suiteTeardown(() => {
            //      asyncDump();
            writeDiffSnapshot(snapshot, `Variable Explorer ${runByLine}`);
        });

        async function addCodeImpartial(
            wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
            code: string,
            waitForVariables: boolean = true,
            waitForVariablesCount: number = 1,
            expectError: boolean = false
        ): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
            const variablesUpdated = waitForVariables
                ? waitForVariablesUpdated(ioc, waitForVariablesCount)
                : Promise.resolve();
            const nodes = wrapper.find('InteractivePanel');
            if (nodes.length > 0) {
                const result = await addCode(ioc, wrapper, code, expectError);
                await variablesUpdated;
                return result;
            } else {
                // For the native editor case, we need to create an editor before hand.
                if (!createdNotebook) {
                    await createNewEditor(ioc);
                    createdNotebook = true;
                }
                await addCell(wrapper, ioc, code, true);
                await variablesUpdated;
                return wrapper;
            }
        }

        runInteractiveTest(
            'Variable explorer - Exclude',
            async (wrapper) => {
                const basicCode: string = `import numpy as np
import pandas as pd
value = 'hello world'`;
                const basicCode2: string = `value2 = 'hello world 2'`;

                openVariableExplorer(wrapper);

                await addCodeImpartial(wrapper, 'a=1\na');
                await addCodeImpartial(wrapper, basicCode, true);

                // We should show a string and show an int, the modules should be hidden
                let targetVariables: IJupyterVariable[] = [
                    {
                        name: 'a',
                        value: '1',
                        supportsDataExplorer: false,
                        type: 'int',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    },
                    // tslint:disable-next-line:quotemark
                    {
                        name: 'value',
                        value: 'hello world',
                        supportsDataExplorer: false,
                        type: 'str',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    }
                ];
                verifyVariables(wrapper, targetVariables);

                // Update our exclude list to exclude strings
                ioc.getSettings().datascience.variableExplorerExclude = `${
                    ioc.getSettings().datascience.variableExplorerExclude
                };str`;

                // Add another string and check our vars, strings should be hidden
                await addCodeImpartial(wrapper, basicCode2, true);

                targetVariables = [
                    {
                        name: 'a',
                        value: '1',
                        supportsDataExplorer: false,
                        type: 'int',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    }
                ];
                verifyVariables(wrapper, targetVariables);
            },
            () => {
                return Promise.resolve(ioc);
            }
        );

        runInteractiveTest(
            'Variable explorer - Update',
            async (wrapper) => {
                const basicCode: string = `value = 'hello world'`;
                const basicCode2: string = `value2 = 'hello world 2'`;

                openVariableExplorer(wrapper);

                await addCodeImpartial(wrapper, 'a=1\na');

                // Check that we have just the 'a' variable
                let targetVariables: IJupyterVariable[] = [
                    {
                        name: 'a',
                        value: '1',
                        supportsDataExplorer: false,
                        type: 'int',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    }
                ];
                verifyVariables(wrapper, targetVariables);

                // Add another variable and check it
                await addCodeImpartial(wrapper, basicCode, true);

                targetVariables = [
                    {
                        name: 'a',
                        value: '1',
                        supportsDataExplorer: false,
                        type: 'int',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    },
                    {
                        name: 'value',
                        value: 'hello world',
                        supportsDataExplorer: false,
                        type: 'str',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    }
                ];
                verifyVariables(wrapper, targetVariables);

                // Add a second variable and check it
                await addCodeImpartial(wrapper, basicCode2, true);

                targetVariables = [
                    {
                        name: 'a',
                        value: '1',
                        supportsDataExplorer: false,
                        type: 'int',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    },
                    {
                        name: 'value',
                        value: 'hello world',
                        supportsDataExplorer: false,
                        type: 'str',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    },
                    // tslint:disable-next-line:quotemark
                    {
                        name: 'value2',
                        value: 'hello world 2',
                        supportsDataExplorer: false,
                        type: 'str',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    }
                ];
                verifyVariables(wrapper, targetVariables);
            },
            () => {
                return Promise.resolve(ioc);
            }
        );

        // Test our display of basic types. We render 8 rows by default so only 8 values per test
        runInteractiveTest(
            'Variable explorer - Types A',
            async (wrapper) => {
                const basicCode: string = `myList = [1, 2, 3]
mySet = set([42])
myDict = {'a': 1}`;

                openVariableExplorer(wrapper);

                await addCodeImpartial(wrapper, 'a=1\na');
                await addCodeImpartial(wrapper, basicCode, true);

                const targetVariables: IJupyterVariable[] = [
                    {
                        name: 'a',
                        value: '1',
                        supportsDataExplorer: false,
                        type: 'int',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    },
                    // tslint:disable-next-line:quotemark
                    {
                        name: 'myDict',
                        value: "{'a': 1}",
                        supportsDataExplorer: true,
                        type: 'dict',
                        size: 54,
                        shape: '',
                        count: 1,
                        truncated: false
                    },
                    {
                        name: 'myList',
                        value: '[1, 2, 3]',
                        supportsDataExplorer: true,
                        type: 'list',
                        size: 54,
                        shape: '',
                        count: 3,
                        truncated: false
                    },
                    // Set can vary between python versions, so just don't both to check the value, just see that we got it
                    {
                        name: 'mySet',
                        value: undefined,
                        supportsDataExplorer: false,
                        type: 'set',
                        size: 54,
                        shape: '',
                        count: 1,
                        truncated: false
                    }
                ];
                verifyVariables(wrapper, targetVariables);
                // Step into the first cell over again. Should have the same variables
                if (runByLine) {
                    await verifyAfterStep(ioc, wrapper, () => {
                        verifyVariables(wrapper, targetVariables);
                        return Promise.resolve();
                    });
                }

                // Restart the kernel and repeat
                const interactive = await getOrCreateInteractiveWindow(ioc);

                const variablesComplete = waitForMessage(ioc, InteractiveWindowMessages.VariablesComplete);
                await interactive.restartKernel();
                await variablesComplete; // Restart should cause a variable refresh

                // Should have no variables
                verifyVariables(wrapper, []);

                await addCodeImpartial(wrapper, 'a=1\na', true);
                await addCodeImpartial(wrapper, basicCode, true);

                verifyVariables(wrapper, targetVariables);
                // Step into the first cell over again. Should have the same variables
                if (runByLine) {
                    await verifyAfterStep(ioc, wrapper, () => {
                        verifyVariables(wrapper, targetVariables);
                        return Promise.resolve();
                    });
                }
            },
            () => {
                return Promise.resolve(ioc);
            }
        );

        runInteractiveTest(
            'Variable explorer - Basic B',
            async (wrapper) => {
                const basicCode: string = `import numpy as np
import pandas as pd
myComplex = complex(1, 1)
myInt = 99999999
myFloat = 9999.9999
mynpArray = np.array([1.0, 2.0, 3.0])
myDataframe = pd.DataFrame(mynpArray)
mySeries = myDataframe[0]
myTuple = 1,2,3,4,5,6,7,8,9
`;

                openVariableExplorer(wrapper);

                await addCodeImpartial(wrapper, 'a=1\na');
                await addCodeImpartial(wrapper, basicCode, true, 2);

                const targetVariables: IJupyterVariable[] = [
                    {
                        name: 'a',
                        value: '1',
                        supportsDataExplorer: false,
                        type: 'int',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    },
                    {
                        name: 'myComplex',
                        value: '(1+1j)',
                        supportsDataExplorer: false,
                        type: 'complex',
                        size: 54,
                        shape: '',
                        count: 0,
                        truncated: false
                    },
                    {
                        name: 'myDataframe',
                        value: `0
0 1.0
1 2.0
2 3.0`,
                        supportsDataExplorer: true,
                        type: 'DataFrame',
                        size: 54,
                        shape: '(3, 1)',
                        count: 0,
                        truncated: false
                    },
                    {
                        name: 'myFloat',
                        value: '9999.9999',
                        supportsDataExplorer: false,
                        type: 'float',
                        size: 58,
                        shape: '',
                        count: 0,
                        truncated: false
                    },
                    {
                        name: 'myInt',
                        value: '99999999',
                        supportsDataExplorer: false,
                        type: 'int',
                        size: 56,
                        shape: '',
                        count: 0,
                        truncated: false
                    },
                    // tslint:disable:no-trailing-whitespace
                    {
                        name: 'mySeries',
                        value: `0 1.0
1 2.0
2 3.0
Name: 0, dtype: float64`,
                        supportsDataExplorer: true,
                        type: 'Series',
                        size: 54,
                        shape: '(3,)',
                        count: 0,
                        truncated: false
                    },
                    {
                        name: 'myTuple',
                        value: '(1, 2, 3, 4, 5, 6, 7, 8, 9)',
                        supportsDataExplorer: false,
                        type: 'tuple',
                        size: 54,
                        shape: '9',
                        count: 0,
                        truncated: false
                    },
                    {
                        name: 'mynpArray',
                        value: '[1. 2. 3.]',
                        supportsDataExplorer: true,
                        type: 'ndarray',
                        size: 54,
                        shape: '(3,)',
                        count: 0,
                        truncated: false
                    }
                ];
                verifyVariables(wrapper, targetVariables);

                // Step into the first cell over again. Should have the same variables
                if (runByLine) {
                    targetVariables[7].value = 'array([1., 2., 3.])'; // Debugger shows np array differently
                    await verifyAfterStep(ioc, wrapper, () => {
                        verifyVariables(wrapper, targetVariables);
                        return Promise.resolve();
                    });
                }
            },
            () => {
                return Promise.resolve(ioc);
            }
        );

        function generateVar(v: number): IJupyterVariable {
            const valueEntry = Math.pow(v, 2) % 17;
            const expectedValue =
                valueEntry < 10
                    ? `[${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, <...> , ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}]`
                    : `[${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, <...> , ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}]`;
            return {
                name: `var${v}`,
                value: expectedValue,
                supportsDataExplorer: true,
                type: 'list',
                size: 54,
                shape: '',
                count: 100000,
                truncated: false
            };
        }

        // Test our limits. Create 1050 items. Do this with both to make
        // sure no perf problems with one or the other and to smoke test the native editor
        runDoubleTest(
            'Variable explorer - A lot of items',
            async (t, wrapper) => {
                const basicCode: string = `for _i in range(1050):
    exec("var{}=[{} ** 2 % 17 for _l in range(100000)]".format(_i, _i))`;

                openVariableExplorer(wrapper);

                // Wait for two variable completes so we get the visible list (should be about 16 items when finished)
                await addCodeImpartial(wrapper, basicCode, true, 2);

                const allVariables: IJupyterVariable[] = rangeInclusive(0, 1050)
                    .map(generateVar)
                    .sort((a: IJupyterVariable, b: IJupyterVariable) => a.name.localeCompare(b.name));

                const targetVariables = allVariables.slice(0, 16);
                verifyVariables(wrapper, targetVariables);

                // Force a scroll to the bottom
                const complete = waitForMessage(ioc, InteractiveWindowMessages.VariablesComplete, { numberOfTimes: 2 });
                const grid = wrapper.find(AdazzleReactDataGrid);
                const viewPort = grid.find('Viewport').instance();
                const rowHeight = (viewPort.props as any).rowHeight as number;
                const scrollTop = (allVariables.length - 11) * rowHeight;
                (viewPort as any).onScroll({ scrollTop, scrollLeft: 0 });

                // Wait for a variable complete
                await complete;

                // Now we should have the bottom. For some reason only 10 come back here.
                const bottomVariables = allVariables.slice(1041, 1051);
                verifyVariables(wrapper, bottomVariables);

                // Step into the first cell over again. Should have the same variables
                if (runByLine && t === 'interactive') {
                    // Remove values, don't bother checking them as they'll be different from the debugger
                    const nonValued = targetVariables.map((v) => {
                        return { ...v, value: undefined };
                    });
                    await verifyAfterStep(ioc, wrapper, () => {
                        verifyVariables(wrapper, nonValued);
                        return Promise.resolve();
                    });
                }
            },
            () => {
                return Promise.resolve(ioc);
            }
        );

        runInteractiveTest(
            'Variable explorer - DataFrameInfo and Rows',
            async (wrapper) => {
                const basicCode: string = `import numpy as np
import pandas as pd
mynpArray = np.array([1.0, 2.0, 3.0])
myDataframe = pd.DataFrame(mynpArray)
mySeries = myDataframe[0]
`;

                openVariableExplorer(wrapper);

                await addCodeImpartial(wrapper, 'a=1\na');
                await addCodeImpartial(wrapper, basicCode, true);

                await verifyCanFetchData(ioc, 2, 'myDataframe', [1, 2, 3]);
                await verifyCanFetchData(ioc, 2, 'mynpArray', [1, 2, 3]);
                await verifyCanFetchData(ioc, 2, 'mySeries', [1, 2, 3]);

                // Step into the first cell over again. Should have the same variables
                if (runByLine) {
                    await verifyAfterStep(ioc, wrapper, async (_w) => {
                        await verifyCanFetchData(ioc, 2, 'myDataframe', [1, 2, 3]);
                        await verifyCanFetchData(ioc, 2, 'mynpArray', [1, 2, 3]);
                        await verifyCanFetchData(ioc, 2, 'mySeries', [1, 2, 3]);
                    });
                }
            },
            () => {
                return Promise.resolve(ioc);
            }
        );
    });
});
