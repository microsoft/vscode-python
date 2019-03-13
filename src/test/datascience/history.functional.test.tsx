// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { mount, ReactWrapper } from 'enzyme';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as React from 'react';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { Disposable, TextDocument, TextEditor } from 'vscode';

import {
    IApplicationShell,
    IDocumentManager,
    IWebPanel,
    IWebPanelMessageListener,
    IWebPanelProvider,
    WebPanelMessage
} from '../../client/common/application/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { Architecture } from '../../client/common/utils/platform';
import { EditorContexts } from '../../client/datascience/constants';
import { HistoryMessageListener } from '../../client/datascience/historyMessageListener';
import { HistoryMessages } from '../../client/datascience/historyTypes';
import { IHistory, IHistoryProvider, IJupyterExecution } from '../../client/datascience/types';
import { InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { CellButton } from '../../datascience-ui/history-react/cellButton';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
import { IVsCodeApi } from '../../datascience-ui/react-common/postOffice';
import { sleep } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import {
    addCode,
    addContinuousMockData,
    addMockData,
    CellInputState,
    CellPosition,
    defaultDataScienceSettings,
    enterInput,
    escapePath,
    findButton,
    getCellResults,
    getLastOutputCell,
    getMainPanel,
    initialDataScienceSettings,
    srcDirectory,
    toggleCellExpansion,
    updateDataScienceSettings,
    verifyHtmlOnCell,
    verifyLastCellInputState
} from './historyTestHelpers';
import { SupportedCommands } from './mockJupyterManager';
import { blurWindow, waitForUpdate } from './reactHelpers';

// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
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

    async function getOrCreateHistory(): Promise<IHistory> {
        const result = await historyProvider.getOrCreateActive();

        // During testing the MainPanel sends the init message before our history is created.
        // Pretend like it's happening now
        const listener = ((result as any)['messageListener']) as HistoryMessageListener;
        listener.onMessage(HistoryMessages.Started, {});

        return result;
    }

    // tslint:disable-next-line:no-any
    function runMountedTest(name: string, testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>) {
        test(name, async () => {
            addMockData(ioc, 'a=1\na', 1);
            if (await jupyterExecution.isNotebookSupported()) {
                // Create our main panel and tie it into the JSDOM. Ignore progress so we only get a single render
                const wrapper = mount(<MainPanel baseTheme='vscode-light' codeTheme='light_vs' testMode={true} skipDefault={true} />);
                getMainPanel(wrapper);
                try {
                    await testFunc(wrapper);
                } finally {
                    // Blur window focus so we don't have editors polling
                    blurWindow();

                    // Make sure to unmount the wrapper or it will interfere with other tests
                    wrapper.unmount();
                }
            } else {
                // tslint:disable-next-line:no-console
                console.log(`${name} skipped, no Jupyter installed.`);
            }
        });
    }

    async function waitForMessageResponse(action: () => void): Promise<void> {
        webPanelMessagePromise = createDeferred();
        action();
        await webPanelMessagePromise.promise;
        webPanelMessagePromise = undefined;
    }

    runMountedTest('Simple text', async (wrapper) => {
        await addCode(getOrCreateHistory, wrapper, 'a=1\na');

        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    });

    runMountedTest('Hide inputs', async (wrapper) => {
        initialDataScienceSettings({ ...defaultDataScienceSettings(), showCellInputCode: false });

        await addCode(getOrCreateHistory, wrapper, 'a=1\na');

        verifyLastCellInputState(wrapper, CellInputState.Hidden);

        // Add a cell without output, this cell should not show up at all
        addMockData(ioc, 'a=1', undefined, 'text/plain');
        await addCode(getOrCreateHistory, wrapper, 'a=1', 4);

        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.First);
        verifyHtmlOnCell(wrapper, undefined, CellPosition.Last);
    });

    runMountedTest('Show inputs', async (wrapper) => {
        initialDataScienceSettings({ ...defaultDataScienceSettings() });

        await addCode(getOrCreateHistory, wrapper, 'a=1\na');

        verifyLastCellInputState(wrapper, CellInputState.Visible);
        verifyLastCellInputState(wrapper, CellInputState.Collapsed);
    });

    runMountedTest('Expand inputs', async (wrapper) => {
        initialDataScienceSettings({ ...defaultDataScienceSettings(), collapseCellInputCodeByDefault: false });
        await addCode(getOrCreateHistory, wrapper, 'a=1\na');

        verifyLastCellInputState(wrapper, CellInputState.Expanded);
    });

    runMountedTest('Collapse / expand cell', async (wrapper) => {
        initialDataScienceSettings({ ...defaultDataScienceSettings() });
        await addCode(getOrCreateHistory, wrapper, 'a=1\na');

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
        await addCode(getOrCreateHistory, wrapper, 'a=1\na');

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

        addMockData(ioc, badPanda, `pandas has no attribute 'read'`, 'text/html', 'error');
        addMockData(ioc, goodPanda, `<td>A table</td>`, 'text/html');
        addMockData(ioc, matPlotLib, matPlotLibResults, 'text/html');
        const cursors = ['|', '/', '-', '\\'];
        let cursorPos = 0;
        let loops = 3;
        addContinuousMockData(ioc, spinningCursor, async (c) => {
            const result = `${cursors[cursorPos]}\r`;
            cursorPos += 1;
            if (cursorPos >= cursors.length) {
                cursorPos = 0;
                loops -= 1;
            }
            return Promise.resolve({ result: result, haveMore: loops > 0 });
        });

        await addCode(getOrCreateHistory, wrapper, badPanda, 4);
        verifyHtmlOnCell(wrapper, `has no attribute 'read'`, CellPosition.Last);

        await addCode(getOrCreateHistory, wrapper, goodPanda);
        verifyHtmlOnCell(wrapper, `<td>`, CellPosition.Last);

        await addCode(getOrCreateHistory, wrapper, matPlotLib);
        verifyHtmlOnCell(wrapper, matPlotLibResults, CellPosition.Last);

        await addCode(getOrCreateHistory, wrapper, spinningCursor, 4 + (ioc.mockJupyter ? (cursors.length * 3) : 0));
        verifyHtmlOnCell(wrapper, '<xmp>', CellPosition.Last);
    });

    runMountedTest('Undo/redo commands', async (wrapper) => {
        const history = await getOrCreateHistory();

        // Get a cell into the list
        await addCode(getOrCreateHistory, wrapper, 'a=1\na');

        // Now verify if we undo, we have no cells
        let afterUndo = await getCellResults(wrapper, 1, () => {
            history.undoCells();
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 1, `Undo should remove cells + ${afterUndo.debug()}`);

        // Redo should put the cells back
        const afterRedo = await getCellResults(wrapper, 1, () => {
            history.redoCells();
            return Promise.resolve();
        });
        assert.equal(afterRedo.length, 2, 'Redo should put cells back');

        // Get another cell into the list
        const afterAdd = await addCode(getOrCreateHistory, wrapper, 'a=1\na');
        assert.equal(afterAdd.length, 3, 'Second cell did not get added');

        // Clear everything
        const afterClear = await getCellResults(wrapper, 1, () => {
            history.removeAllCells();
            return Promise.resolve();
        });
        assert.equal(afterClear.length, 1, 'Clear didn\'t work');

        // Undo should put them back
        afterUndo = await getCellResults(wrapper, 1, () => {
            history.undoCells();
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 3, `Undo should put cells back`);
    });

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
        await addCode(getOrCreateHistory, wrapper, 'a=1\na');

        // 'Click' the buttons in the react control
        const undo = findButton(wrapper, 5);
        const redo = findButton(wrapper, 6);
        const clear = findButton(wrapper, 7);

        // Now verify if we undo, we have no cells
        let afterUndo = await getCellResults(wrapper, 1, () => {
            undo!.simulate('click');
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 1, `Undo should remove cells + ${afterUndo.debug()}`);

        // Redo should put the cells back
        const afterRedo = await getCellResults(wrapper, 1, async () => {
            redo!.simulate('click');
            return Promise.resolve();
        });
        assert.equal(afterRedo.length, 2, 'Redo should put cells back');

        // Get another cell into the list
        const afterAdd = await addCode(getOrCreateHistory, wrapper, 'a=1\na');
        assert.equal(afterAdd.length, 3, 'Second cell did not get added');

        // Clear everything
        const afterClear = await getCellResults(wrapper, 1, async () => {
            clear!.simulate('click');
            return Promise.resolve();
        });
        assert.equal(afterClear.length, 1, 'Clear didn\'t work');

        // Undo should put them back
        afterUndo = await getCellResults(wrapper, 1, async () => {
            undo!.simulate('click');
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 3, `Undo should put cells back`);

        // find the buttons on the cell itself
        const cellButtons = afterUndo.at(afterUndo.length - 2).find(CellButton);
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
        assert.equal(afterDelete.length, 2, `Delete should remove a cell`);
    });

    runMountedTest('Export', async (wrapper) => {
        // Export should cause the export dialog to come up. Remap appshell so we can check
        const dummyDisposable = {
            dispose: () => { return; }
        };
        let exportCalled = false;
        const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        appShell.setup(a => a.showErrorMessage(TypeMoq.It.isAnyString())).returns((e) => { throw e; });
        appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showSaveDialog(TypeMoq.It.isAny())).returns(() => {
            exportCalled = true;
            return Promise.resolve(undefined);
        });
        appShell.setup(a => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);
        ioc.serviceManager.rebindInstance<IApplicationShell>(IApplicationShell, appShell.object);

        // Make sure to create the history after the rebind or it gets the wrong application shell.
        await addCode(getOrCreateHistory, wrapper, 'a=1\na');
        const history = await getOrCreateHistory();

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

        assert.equal(afterUndo.length, 1, `Undo should remove cells + ${afterUndo.debug()}`);

        // Then verify we cannot click the button (it should be disabled)
        exportCalled = false;
        const response = waitForMessageResponse(() => exportButton!.simulate('click'));
        await Promise.race([sleep(10), response]);
        assert.equal(exportCalled, false, 'Export should not be called when no cells visible');

    });

    test('Dispose test', async () => {
        // tslint:disable-next-line:no-any
        if (await jupyterExecution.isNotebookSupported()) {
            const history = await getOrCreateHistory();
            await history.show(); // Have to wait for the load to finish
            await history.dispose();
            // tslint:disable-next-line:no-any
            const h2 = await getOrCreateHistory();
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
        const history = await getOrCreateHistory();

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

    runMountedTest('Simple input', async (wrapper) => {
        // Create a history so that it listens to the results.
        const history = await getOrCreateHistory();
        await history.show();

        // Then enter some code.
        await enterInput(wrapper, 'a=1\na');
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    });

    runMountedTest('Multiple input', async (wrapper) => {
        // Create a history so that it listens to the results.
        const history = await getOrCreateHistory();
        await history.show();

        // Then enter some code.
        await enterInput(wrapper, 'a=1\na');
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);

        // Then delete the node
        const lastCell = getLastOutputCell(wrapper);
        const cellButtons = lastCell.find(CellButton);
        assert.equal(cellButtons.length, 2, 'Cell buttons not found');
        const deleteButton = cellButtons.at(0);

        // Make sure delete works
        const afterDelete = await getCellResults(wrapper, 1, async () => {
            deleteButton.simulate('click');
            return Promise.resolve();
        });
        assert.equal(afterDelete.length, 1, `Delete should remove a cell`);

        // Should be able to enter again
        await enterInput(wrapper, 'a=1\na');
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);

        // Try a 3rd time with some new input
        addMockData(ioc, 'print("hello")', 'hello');
        await enterInput(wrapper, 'print("hello")');
        verifyHtmlOnCell(wrapper, '<span>hello</span>', CellPosition.Last);
    });
});
