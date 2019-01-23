// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { mount, ReactWrapper } from 'enzyme';
import * as fs from 'fs-extra';
import { min } from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { CancellationToken, Disposable, TextDocument, TextEditor } from 'vscode';

import {
    IApplicationShell,
    IDocumentManager,
    IWebPanel,
    IWebPanelMessageListener,
    IWebPanelProvider,
    WebPanelMessage
} from '../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { IDataScienceSettings } from '../../client/common/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { Architecture } from '../../client/common/utils/platform';
import { EditorContexts, HistoryMessages } from '../../client/datascience/constants';
import { IHistoryProvider, IJupyterExecution } from '../../client/datascience/types';
import { InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { CellButton } from '../../datascience-ui/history-react/cellButton';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
import { IVsCodeApi } from '../../datascience-ui/react-common/postOffice';
import { updateSettings } from '../../datascience-ui/react-common/settingsReactSide';
import { sleep } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { SupportedCommands } from './mockJupyterManager';
import { waitForUpdate } from './reactHelpers';

//tslint:disable:trailing-comma no-any no-multiline-string
enum CellInputState {
    Hidden,
    Visible,
    Collapsed,
    Expanded
}

enum CellPosition {
    First = 'first',
    Last = 'last'
}

// tslint:disable-next-line:max-func-body-length no-any
suite('History output tests', () => {
    const disposables: Disposable[] = [];
    let jupyterExecution: IJupyterExecution;
    let webPanelProvider: TypeMoq.IMock<IWebPanelProvider>;
    let webPanel: TypeMoq.IMock<IWebPanel>;
    let historyProvider: IHistoryProvider;
    let webPanelListener: IWebPanelMessageListener;
    let globalAcquireVsCodeApi: () => IVsCodeApi;
    let ioc: DataScienceIocContainer;
    let webPanelMessagePromise: Deferred<void> | undefined;

    const workingPython: PythonInterpreter = {
        path: '/foo/bar/python.exe',
        version: new SemVer('3.6.6-final'),
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python',
        type: InterpreterType.Unknown,
        architecture: Architecture.x64,
    };
    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();

        if (ioc.mockJupyter) {
            ioc.mockJupyter.addInterpreter(workingPython, SupportedCommands.all);
        }

        webPanelProvider = TypeMoq.Mock.ofType<IWebPanelProvider>();
        webPanel = TypeMoq.Mock.ofType<IWebPanel>();

        ioc.serviceManager.addSingletonInstance<IWebPanelProvider>(IWebPanelProvider, webPanelProvider.object);

        // Setup the webpanel provider so that it returns our dummy web panel. It will have to talk to our global JSDOM window so that the react components can link into it
        webPanelProvider.setup(p => p.create(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((listener: IWebPanelMessageListener, title: string, script: string, css: string) => {
            // Keep track of the current listener. It listens to messages through the vscode api
            webPanelListener = listener;

            // Return our dummy web panel
            return webPanel.object;
        });
        webPanel.setup(p => p.postMessage(TypeMoq.It.isAny())).callback((m: WebPanelMessage) => {
            window.postMessage(m, '*');
        }); // See JSDOM valid target origins
        webPanel.setup(p => p.show());

        jupyterExecution = ioc.serviceManager.get<IJupyterExecution>(IJupyterExecution);
        historyProvider = ioc.serviceManager.get<IHistoryProvider>(IHistoryProvider);

        // Setup a global for the acquireVsCodeApi so that the React PostOffice can find it
        globalAcquireVsCodeApi = (): IVsCodeApi => {
            return {
                // tslint:disable-next-line:no-any
                postMessage: (msg: any) => {
                    if (webPanelListener) {
                        webPanelListener.onMessage(msg.type, msg.payload);
                    }
                    if (webPanelMessagePromise) {
                        webPanelMessagePromise.resolve();
                    }
                },
                // tslint:disable-next-line:no-any no-empty
                setState: (msg: any) => {

                },
                // tslint:disable-next-line:no-any no-empty
                getState: () => {
                    return {};
                }
            };
        };
        // tslint:disable-next-line:no-string-literal
        (global as any)['acquireVsCodeApi'] = globalAcquireVsCodeApi;
    });

    teardown(async () => {
        for (let i = 0; i < disposables.length; i += 1) {
            const disposable = disposables[i];
            if (disposable) {
                // tslint:disable-next-line:no-any
                const promise = disposable.dispose() as Promise<any>;
                if (promise) {
                    await promise;
                }
            }
        }
        await ioc.dispose();
        delete (global as any)['ascquireVsCodeApi'];
    });

    function addMockData(code: string, result: string | number | undefined, mimeType?: string, cellType?: string) {
        if (ioc.mockJupyter) {
            if (cellType && cellType === 'error') {
                ioc.mockJupyter.addError(code, result ? result.toString() : '');
            } else {
                if (result) {
                    ioc.mockJupyter.addCell(code, result, mimeType);
                } else {
                    ioc.mockJupyter.addCell(code);
                }
            }
        }
    }

    function addContinuousMockData(code: string, resultGenerator: (c: CancellationToken) => Promise<{ result: string; haveMore: boolean }>) {
        if (ioc.mockJupyter) {
            ioc.mockJupyter.addContinuousOutputCell(code, resultGenerator);
        }
    }

    // tslint:disable-next-line:no-any
    function runMountedTest(name: string, testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>) {
        test(name, async () => {
            addMockData('a=1\na', 1);
            if (await jupyterExecution.isNotebookSupported()) {
                // Create our main panel and tie it into the JSDOM. Ignore progress so we only get a single render
                const wrapper = mount(<MainPanel baseTheme='vscode-light' codeTheme='light_vs' testMode={true} skipDefault={true} />);
                try {
                    await testFunc(wrapper);
                } finally {
                    // Make sure to unmount the wrapper or it will interfere with other tests
                    wrapper.unmount();
                }
            } else {
                // tslint:disable-next-line:no-console
                console.log(`${name} skipped, no Jupyter installed.`);
            }
        });
    }

    function verifyHtmlOnCell(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, html: string | undefined, cellIndex: number | CellPosition) {
        const foundResult = wrapper.find('Cell');
        assert.ok(foundResult.length >= 1, 'Didn\'t find any cells being rendered');

        let targetCell: ReactWrapper;
        // Get the correct result that we are dealing with
        if (typeof cellIndex === 'number') {
            if (cellIndex >= 0 && cellIndex <= (foundResult.length - 1)) {
                targetCell = foundResult.at(cellIndex);
            }
        } else if (typeof cellIndex === 'string') {
            switch (cellIndex) {
                case CellPosition.First:
                    targetCell = foundResult.first();
                    break;

                case CellPosition.Last:
                    targetCell = foundResult.last();
                    break;

                default:
                    // Fall through, targetCell check will fail out
                    break;
            }
        }

        // ! is ok here to get rid of undefined type check as we want a fail here if we have not initialized targetCell
        assert.ok(targetCell!, 'Target cell doesn\'t exist');

        // If html is specified, check it
        if (html) {
            // Extract only the first 100 chars from the input string
            const sliced = html.substr(0, min([html.length, 100]));
            const output = targetCell!.find('div.cell-output');
            assert.ok(output.length > 0, 'No output cell found');
            const outHtml = output.html();
            assert.ok(outHtml.includes(sliced), `${outHtml} does not contain ${sliced}`);
        } else {
            // html not specified, look for an empty render
            assert.ok(targetCell!.isEmptyRender(), 'Target cell is not empty render');
        }
    }

    function verifyLastCellInputState(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, state: CellInputState) {
        const foundResult = wrapper.find('Cell');
        assert.ok(foundResult.length >= 1, 'Didn\'t find any cells being rendered');

        const lastCell = foundResult.last();
        assert.ok(lastCell, 'Last call doesn\'t exist');

        const inputBlock = lastCell.find('div.cell-input');
        const toggleButton = lastCell.find('polygon.collapse-input-svg');

        switch (state) {
            case CellInputState.Hidden:
                assert.ok(inputBlock.length === 0, 'Cell input not hidden');
                break;

            case CellInputState.Visible:
                assert.ok(inputBlock.length === 1, 'Cell input not visible');
                break;

            case CellInputState.Expanded:
                assert.ok(toggleButton.html().includes('collapse-input-svg-rotate'), 'Cell input toggle not expanded');
                break;

            case CellInputState.Collapsed:
                assert.ok(!toggleButton.html().includes('collapse-input-svg-rotate'), 'Cell input toggle not collapsed');
                break;

            default:
                assert.fail('Unknown cellInputStat');
                break;
        }
    }

    async function waitForMessageResponse(action: () => void): Promise<void> {
        webPanelMessagePromise = createDeferred();
        action();
        await webPanelMessagePromise.promise;
        webPanelMessagePromise = undefined;
    }

    async function getCellResults(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, expectedRenders: number, updater: () => Promise<void>): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {

        // Get a render promise with the expected number of renders
        const renderPromise = waitForUpdate(wrapper, MainPanel, expectedRenders);

        // Call our function to update the react control
        await updater();

        // Wait for all of the renders to go through
        await renderPromise;

        // Return the result
        return wrapper.find('Cell');
    }

    async function addCode(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, code: string, expectedRenderCount: number = 5): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
        // Adding code should cause 5 renders to happen.
        // 1) Input
        // 2) Status ready
        // 3) Execute_Input message
        // 4) Output message (if there's only one)
        // 5) Status finished
        return getCellResults(wrapper, expectedRenderCount, async () => {
            const history = historyProvider.getOrCreateActive();
            await history.addCode(code, 'foo.py', 2);
        });
    }

    runMountedTest('Simple text', async (wrapper) => {
        await addCode(wrapper, 'a=1\na');

        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    });

    runMountedTest('Hide inputs', async (wrapper) => {
        initialDataScienceSettings({ ...defaultDataScienceSettings(), showCellInputCode: false });

        await addCode(wrapper, 'a=1\na');

        verifyLastCellInputState(wrapper, CellInputState.Hidden);

        // Add a cell without output, this cell should not show up at all
        addMockData('a=1', undefined, 'text/plain');
        await addCode(wrapper, 'a=1', 4);

        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.First);
        verifyHtmlOnCell(wrapper, undefined, CellPosition.Last);
    });

    runMountedTest('Show inputs', async (wrapper) => {
        initialDataScienceSettings({ ...defaultDataScienceSettings() });

        await addCode(wrapper, 'a=1\na');

        verifyLastCellInputState(wrapper, CellInputState.Visible);
        verifyLastCellInputState(wrapper, CellInputState.Collapsed);
    });

    runMountedTest('Expand inputs', async (wrapper) => {
        initialDataScienceSettings({ ...defaultDataScienceSettings(), collapseCellInputCodeByDefault: false });
        await addCode(wrapper, 'a=1\na');

        verifyLastCellInputState(wrapper, CellInputState.Expanded);
    });

    runMountedTest('Collapse / expand cell', async (wrapper) => {
        initialDataScienceSettings({ ...defaultDataScienceSettings() });
        await addCode(wrapper, 'a=1\na');

        verifyLastCellInputState(wrapper, CellInputState.Visible);
        verifyLastCellInputState(wrapper, CellInputState.Collapsed);

        toggleCellExpansion(wrapper);

        verifyLastCellInputState(wrapper, CellInputState.Visible);
        verifyLastCellInputState(wrapper, CellInputState.Expanded);

        toggleCellExpansion(wrapper);

        verifyLastCellInputState(wrapper, CellInputState.Visible);
        verifyLastCellInputState(wrapper, CellInputState.Collapsed);
    });

    runMountedTest('Hide / show cell', async (wrapper) => {
        initialDataScienceSettings({ ...defaultDataScienceSettings() });
        await addCode(wrapper, 'a=1\na');

        verifyLastCellInputState(wrapper, CellInputState.Visible);
        verifyLastCellInputState(wrapper, CellInputState.Collapsed);

        // Hide the inputs and verify
        updateDataScienceSettings(wrapper, { ...defaultDataScienceSettings(), showCellInputCode: false });

        verifyLastCellInputState(wrapper, CellInputState.Hidden);

        // Show the inputs and verify
        updateDataScienceSettings(wrapper, { ...defaultDataScienceSettings(), showCellInputCode: true });

        verifyLastCellInputState(wrapper, CellInputState.Visible);
        verifyLastCellInputState(wrapper, CellInputState.Collapsed);
    });

    // The default base set of data science settings to use
    function defaultDataScienceSettings(): IDataScienceSettings {
        return {
            allowImportFromNotebook: true,
            jupyterLaunchTimeout: 10,
            enabled: true,
            jupyterServerURI: 'local',
            notebookFileRoot: 'WORKSPACE',
            changeDirOnImportExport: true,
            useDefaultConfigForJupyter: true,
            jupyterInterruptTimeout: 10000,
            searchForJupyter: true,
            showCellInputCode: true,
            collapseCellInputCodeByDefault: true
        };
    }

    // Set initial data science settings to use for a test (initially loaded via settingsReactSide.ts)
    function initialDataScienceSettings(newSettings: IDataScienceSettings) {
        const settingsString = JSON.stringify(newSettings);
        updateSettings(settingsString);
    }

    // Update data science settings while running (goes through the UpdateSettings channel)
    function updateDataScienceSettings(wrapper: ReactWrapper<any, Readonly<{}>>, newSettings: IDataScienceSettings) {
        const settingsString = JSON.stringify(newSettings);

        const mainObj = wrapper.find(MainPanel);
        if (mainObj) {
            const panel = mainObj.instance() as MainPanel;
            panel.handleMessage(HistoryMessages.UpdateSettings, settingsString);
        }
        wrapper.update();
    }

    function toggleCellExpansion(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) {
        const foundResult = wrapper.find('Cell');
        assert.ok(foundResult.length >= 1, 'Didn\'t find any cells being rendered');

        // Find the last cell added
        const lastCell = foundResult.last();
        assert.ok(lastCell, 'Last call doesn\'t exist');

        const toggleButton = lastCell.find('button.collapse-input');
        assert.ok(toggleButton);
        toggleButton.simulate('click');
    }

    function escapePath(p: string) {
        return p.replace(/\\/g, '\\\\');
    }

    function srcDirectory() {
        return path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');
    }

    runMountedTest('Mime Types', async (wrapper) => {

        const badPanda = `import pandas as pd
df = pd.read("${escapePath(path.join(srcDirectory(), 'DefaultSalesReport.csv'))}")
df.head()`;
        const goodPanda = `import pandas as pd
df = pd.read_csv("${escapePath(path.join(srcDirectory(), 'DefaultSalesReport.csv'))}")
df.head()`;
        const matPlotLib = 'import matplotlib.pyplot as plt\r\nimport numpy as np\r\nx = np.linspace(0,20,100)\r\nplt.plot(x, np.sin(x))\r\nplt.show()';
        const matPlotLibResults = await fs.readFile(path.join(srcDirectory(), 'matplotlib.txt'), 'utf8');
        const spinningCursor = `import sys
import time

def spinning_cursor():
    while True:
        for cursor in '|/-\\\\':
            yield cursor

spinner = spinning_cursor()
for _ in range(50):
    sys.stdout.write(next(spinner))
    sys.stdout.flush()
    time.sleep(0.1)
    sys.stdout.write('\\r')`;

        addMockData(badPanda, `pandas has no attribute 'read'`, 'text/html', 'error');
        addMockData(goodPanda, `<td>A table</td>`, 'text/html');
        addMockData(matPlotLib, matPlotLibResults, 'text/html');
        const cursors = ['|', '/', '-', '\\'];
        let cursorPos = 0;
        let loops = 3;
        addContinuousMockData(spinningCursor, async (c) => {
            const result = `${cursors[cursorPos]}\r`;
            cursorPos += 1;
            if (cursorPos >= cursors.length) {
                cursorPos = 0;
                loops -= 1;
            }
            return Promise.resolve({ result: result, haveMore: loops > 0 });
        });

        await addCode(wrapper, badPanda, 4);
        verifyHtmlOnCell(wrapper, `has no attribute 'read'`, CellPosition.Last);

        await addCode(wrapper, goodPanda);
        verifyHtmlOnCell(wrapper, `<td>`, CellPosition.Last);

        await addCode(wrapper, matPlotLib);
        verifyHtmlOnCell(wrapper, matPlotLibResults, CellPosition.Last);

        await addCode(wrapper, spinningCursor, 4 + (ioc.mockJupyter ? (cursors.length * 3) : 0));
        verifyHtmlOnCell(wrapper, '<xmp>', CellPosition.Last);
    });

    runMountedTest('Undo/redo commands', async (wrapper) => {
        const history = historyProvider.getOrCreateActive();

        // Get a cell into the list
        await addCode(wrapper, 'a=1\na');

        // Now verify if we undo, we have no cells
        let afterUndo = await getCellResults(wrapper, 1, () => {
            history.undoCells();
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 0, `Undo should remove cells + ${afterUndo.debug()}`);

        // Redo should put the cells back
        const afterRedo = await getCellResults(wrapper, 1, () => {
            history.redoCells();
            return Promise.resolve();
        });
        assert.equal(afterRedo.length, 1, 'Redo should put cells back');

        // Get another cell into the list
        const afterAdd = await addCode(wrapper, 'a=1\na');
        assert.equal(afterAdd.length, 2, 'Second cell did not get added');

        // Clear everything
        const afterClear = await getCellResults(wrapper, 1, () => {
            history.removeAllCells();
            return Promise.resolve();
        });
        assert.equal(afterClear.length, 0, 'Clear didn\'t work');

        // Undo should put them back
        afterUndo = await getCellResults(wrapper, 1, () => {
            history.undoCells();
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 2, `Undo should put cells back`);
    });

    function findButton(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, index: number): ReactWrapper<any, Readonly<{}>, React.Component> | undefined {
        const mainObj = wrapper.find(MainPanel);
        if (mainObj) {
            const buttons = mainObj.find(CellButton);
            if (buttons) {
                return buttons.at(index);
            }
        }
    }

    runMountedTest('Click buttons', async (wrapper) => {
        // Goto source should cause the visible editor to be picked as long as its filename matches
        const showedEditor = createDeferred();
        const textEditors: TextEditor[] = [];
        const docManager = TypeMoq.Mock.ofType<IDocumentManager>();
        const visibleEditor = TypeMoq.Mock.ofType<TextEditor>();
        const dummyDocument = TypeMoq.Mock.ofType<TextDocument>();
        dummyDocument.setup(d => d.fileName).returns(() => 'foo.py');
        visibleEditor.setup(v => v.show()).returns(() => showedEditor.resolve());
        visibleEditor.setup(v => v.revealRange(TypeMoq.It.isAny())).returns(noop);
        visibleEditor.setup(v => v.document).returns(() => dummyDocument.object);
        textEditors.push(visibleEditor.object);
        docManager.setup(a => a.visibleTextEditors).returns(() => textEditors);
        ioc.serviceManager.rebindInstance<IDocumentManager>(IDocumentManager, docManager.object);

        // Get a cell into the list
        await addCode(wrapper, 'a=1\na');

        // 'Click' the buttons in the react control
        const undo = findButton(wrapper, 5);
        const redo = findButton(wrapper, 6);
        const clear = findButton(wrapper, 7);

        // Now verify if we undo, we have no cells
        let afterUndo = await getCellResults(wrapper, 1, () => {
            undo!.simulate('click');
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 0, `Undo should remove cells + ${afterUndo.debug()}`);

        // Redo should put the cells back
        const afterRedo = await getCellResults(wrapper, 1, async () => {
            redo!.simulate('click');
            return Promise.resolve();
        });
        assert.equal(afterRedo.length, 1, 'Redo should put cells back');

        // Get another cell into the list
        const afterAdd = await addCode(wrapper, 'a=1\na');
        assert.equal(afterAdd.length, 2, 'Second cell did not get added');

        // Clear everything
        const afterClear = await getCellResults(wrapper, 1, async () => {
            clear!.simulate('click');
            return Promise.resolve();
        });
        assert.equal(afterClear.length, 0, 'Clear didn\'t work');

        // Undo should put them back
        afterUndo = await getCellResults(wrapper, 1, async () => {
            undo!.simulate('click');
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 2, `Undo should put cells back`);

        // find the buttons on the cell itself
        const cellButtons = afterUndo.last().find(CellButton);
        assert.equal(cellButtons.length, 2, 'Cell buttons not found');
        const goto = cellButtons.at(1);
        const deleteButton = cellButtons.at(0);

        // Make sure goto works
        await waitForMessageResponse(() => goto.simulate('click'));
        await Promise.race([sleep(100), showedEditor.promise]);
        assert.ok(showedEditor.resolved, 'Goto source is not jumping to editor');

        // Make sure delete works
        const afterDelete = await getCellResults(wrapper, 1, async () => {
            deleteButton.simulate('click');
            return Promise.resolve();
        });
        assert.equal(afterDelete.length, 1, `Delete should remove a cell`);
    });

    runMountedTest('Export', async (wrapper) => {
        // Export should cause the export dialog to come up. Remap appshell so we can check
        const dummyDisposable = {
            dispose: () => { return; }
        };
        let exportCalled = false;
        const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        appShell.setup(a => a.showErrorMessage(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showSaveDialog(TypeMoq.It.isAny())).returns(() => {
            exportCalled = true;
            return Promise.resolve(undefined);
        });
        appShell.setup(a => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);
        ioc.serviceManager.rebindInstance<IApplicationShell>(IApplicationShell, appShell.object);

        // Make sure to create the history after the rebind or it gets the wrong application shell.
        await addCode(wrapper, 'a=1\na');
        const history = historyProvider.getOrCreateActive();

        // Export should cause exportCalled to change to true
        await waitForMessageResponse(() => history.exportCells());
        assert.equal(exportCalled, true, 'Export is not being called during export');

        // Remove the cell
        const exportButton = findButton(wrapper, 2);
        const undo = findButton(wrapper, 5);

        // Now verify if we undo, we have no cells
        const afterUndo = await getCellResults(wrapper, 1, () => {
            undo!.simulate('click');
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 0, `Undo should remove cells + ${afterUndo.debug()}`);

        // Then verify we cannot click the button (it should be disabled)
        exportCalled = false;
        const response = waitForMessageResponse(() => exportButton!.simulate('click'));
        await Promise.race([sleep(10), response]);
        assert.equal(exportCalled, false, 'Export should not be called when no cells visible');

    });

    test('Dispose test', async () => {
        // tslint:disable-next-line:no-any
        if (await jupyterExecution.isNotebookSupported()) {
            const history = historyProvider.getOrCreateActive();
            await history.show(); // Have to wait for the load to finish
            await history.dispose();
            // tslint:disable-next-line:no-any
            const h2 = historyProvider.getOrCreateActive();
            // Check equal and then dispose so the test goes away
            const equal = Object.is(history, h2);
            await h2.show();
            assert.ok(!equal, 'Disposing is not removing the active history');
        } else {
            // tslint:disable-next-line:no-console
            console.log('History test skipped, no Jupyter installed');
        }
    });

    runMountedTest('Editor Context', async (wrapper) => {
        // Verify we can send different commands to the UI and it will respond
        const history = historyProvider.getOrCreateActive();

        // Before we have any cells, verify our contexts are not set
        assert.equal(ioc.getContext(EditorContexts.HaveInteractive), false, 'Should not have interactive before starting');
        assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), false, 'Should not have interactive cells before starting');
        assert.equal(ioc.getContext(EditorContexts.HaveRedoableCells), false, 'Should not have redoable before starting');

        // Get an update promise so we can wait for the add code
        const updatePromise = waitForUpdate(wrapper, MainPanel);

        // Send some code to the history
        await history.addCode('a=1\na', 'foo.py', 2);

        // Wait for the render to go through
        await updatePromise;

        // Now we should have the 3 editor contexts
        assert.equal(ioc.getContext(EditorContexts.HaveInteractive), true, 'Should have interactive after starting');
        assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), true, 'Should have interactive cells after starting');
        assert.equal(ioc.getContext(EditorContexts.HaveRedoableCells), false, 'Should not have redoable after starting');

        // Setup a listener for context change events. We have 3 separate contexts, so we have to wait for all 3.
        let count = 0;
        let deferred = createDeferred<boolean>();
        const eventDispose = ioc.onContextSet(a => {
            count += 1;
            if (count >= 3) {
                deferred.resolve();
            }
        });
        disposables.push(eventDispose);

        // Create a method that resets the waiting
        const resetWaiting = () => {
            count = 0;
            deferred = createDeferred<boolean>();
        };

        // Now send an undo command. This should change the state, so use our waitForInfo promise instead
        resetWaiting();
        history.postMessage(HistoryMessages.Undo);
        await Promise.race([deferred.promise, sleep(2000)]);
        assert.ok(deferred.resolved, 'Never got update to state');
        assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), false, 'Should not have interactive cells after undo as sysinfo is ignored');
        assert.equal(ioc.getContext(EditorContexts.HaveRedoableCells), true, 'Should have redoable after undo');

        resetWaiting();
        history.postMessage(HistoryMessages.Redo);
        await Promise.race([deferred.promise, sleep(2000)]);
        assert.ok(deferred.resolved, 'Never got update to state');
        assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), true, 'Should have interactive cells after redo');
        assert.equal(ioc.getContext(EditorContexts.HaveRedoableCells), false, 'Should not have redoable after redo');

        resetWaiting();
        history.postMessage(HistoryMessages.DeleteAllCells);
        await Promise.race([deferred.promise, sleep(2000)]);
        assert.ok(deferred.resolved, 'Never got update to state');
        assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), false, 'Should not have interactive cells after delete');
    });

    // Tests to do:
    // 1) Cell output works on different mime types. Could just use a notebook to drive
    // 2) History commands work (export/restart/clear all)
    // 3) Jupyter server commands work (open notebook)
    // 4) Changing directories or loading from different directories
    // 5) Telemetry
});
