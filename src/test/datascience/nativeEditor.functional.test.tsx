// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import * as fs from 'fs-extra';
import { parse } from 'node-html-parser';
import * as os from 'os';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Disposable, Selection, TextDocument, TextEditor, Uri } from 'vscode';

import { IApplicationShell, IDocumentManager } from '../../client/common/application/types';
import { createDeferred, waitForPromise } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { generateCellsFromDocument } from '../../client/datascience/cellFactory';
import { concatMultilineString } from '../../client/datascience/common';
import { EditorContexts } from '../../client/datascience/constants';
import {
    InteractiveWindowMessageListener
} from '../../client/datascience/interactive-common/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { IInteractiveWindow, IInteractiveWindowProvider, INotebookEditor, INotebookEditorProvider } from '../../client/datascience/types';
import { InteractivePanel } from '../../datascience-ui/history-react/interactivePanel';
import { ImageButton } from '../../datascience-ui/react-common/imageButton';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { createDocument } from './editor-integration/helpers';
import { MockDocumentManager } from './mockDocumentManager';
import { MockEditor } from './mockTextEditor';
import { waitForUpdate } from './reactHelpers';
import { runMountedTest } from './nativeEditorTestHelpers';
import { verifyHtmlOnCell, CellPosition } from './testHelpers';

//import { asyncDump } from '../common/asyncDump';
// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
suite('DataScience Native Window output tests', () => {
    const disposables: Disposable[] = [];
    let ioc: DataScienceIocContainer;

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
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
    // suiteTeardown(() => {
    //      asyncDump();
    // });

    async function getOrCreateNativeEditor(uri?: Uri, contents?: string): Promise<INotebookEditor> {
        const interactiveWindowProvider = ioc.get<INotebookEditorProvider>(IInteractiveWindowProvider);
        let result: INotebookEditor | undefined;
        if (uri && contents) {
            result = await interactiveWindowProvider.open(uri, contents);
        } else {
            result = await interactiveWindowProvider.createNew();
        }

        // During testing the MainPanel sends the init message before our interactive window is created.
        // Pretend like it's happening now
        const listener = ((result as any).messageListener) as InteractiveWindowMessageListener;
        listener.onMessage(InteractiveWindowMessages.Started, {});

        return result;
    }

    async function waitForMessageResponse(action: () => void): Promise<void> {
        ioc.wrapperCreatedPromise  = createDeferred<boolean>();
        action();
        await ioc.wrapperCreatedPromise.promise;
        ioc.wrapperCreatedPromise = undefined;
    }

    function createNewEditor(): Promise<INotebookEditor> {
        return getOrCreateNativeEditor();
    }

    function openExistingEditor(uri: Uri, contents: string): Promise<INotebookEditor> {
        return getOrCreateNativeEditor(uri, contents);
    }

    runMountedTest('Simple text', async (wrapper) => {
        const editor = await createNewEditor();
        await addCell(editor, wrapper, 'a=1\na');

        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    }, () => { return ioc; });

    runMountedTest('Mime Types', async (wrapper) => {
        const badPanda = `import pandas as pd
df = pd.read("${escapePath(path.join(srcDirectory(), 'DefaultSalesReport.csv'))}")
df.head()`;
        const goodPanda = `import pandas as pd
df = pd.read_csv("${escapePath(path.join(srcDirectory(), 'DefaultSalesReport.csv'))}")
df.head()`;
        const matPlotLib = 'import matplotlib.pyplot as plt\r\nimport numpy as np\r\nx = np.linspace(0,20,100)\r\nplt.plot(x, np.sin(x))\r\nplt.show()';
        const matPlotLibResults = 'img';
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
        addContinuousMockData(ioc, spinningCursor, async (_c) => {
            const result = `${cursors[cursorPos]}\r`;
            cursorPos += 1;
            if (cursorPos >= cursors.length) {
                cursorPos = 0;
                loops -= 1;
            }
            return Promise.resolve({ result: result, haveMore: loops > 0 });
        });

        await addCode(getOrCreateNativeEditor, wrapper, badPanda, 4, true);
        verifyHtmlOnCell(wrapper, `has no attribute 'read'`, CellPosition.Last);

        await addCode(getOrCreateNativeEditor, wrapper, goodPanda);
        verifyHtmlOnCell(wrapper, `<td>`, CellPosition.Last);

        await addCode(getOrCreateNativeEditor, wrapper, matPlotLib);
        verifyHtmlOnCell(wrapper, matPlotLibResults, CellPosition.Last);

        await addCode(getOrCreateNativeEditor, wrapper, spinningCursor, 4 + (ioc.mockJupyter ? (cursors.length * 3) : 0));
        verifyHtmlOnCell(wrapper, '<div>', CellPosition.Last);
    }, () => { return ioc; });

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
        await addCode(getOrCreateNativeEditor, wrapper, 'a=1\na');

        // 'Click' the buttons in the react control
        const undo = findButton(wrapper, 2);
        const redo = findButton(wrapper, 1);
        const clear = findButton(wrapper, 0);

        // Now verify if we undo, we have no cells
        let afterUndo = await getCellResults(wrapper, 1, () => {
            undo!.simulate('click');
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 1, `Undo should remove cells`);

        // Redo should put the cells back
        const afterRedo = await getCellResults(wrapper, 1, async () => {
            redo!.simulate('click');
            return Promise.resolve();
        });
        assert.equal(afterRedo.length, 2, 'Redo should put cells back');

        // Get another cell into the list
        const afterAdd = await addCode(getOrCreateNativeEditor, wrapper, 'a=1\na');
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
        const ImageButtons = afterUndo.at(afterUndo.length - 2).find(ImageButton);
        assert.equal(ImageButtons.length, 4, 'Cell buttons not found');

        const goto = ImageButtons.at(1);
        const deleteButton = ImageButtons.at(3);

        // Make sure goto works
        await waitForMessageResponse(() => goto.simulate('click'));
        await waitForPromise(showedEditor.promise, 1000);
        assert.ok(showedEditor.resolved, 'Goto source is not jumping to editor');

        // Make sure delete works
        const afterDelete = await getCellResults(wrapper, 1, async () => {
            deleteButton.simulate('click');
            return Promise.resolve();
        });
        assert.equal(afterDelete.length, 2, `Delete should remove a cell`);
    }, () => { return ioc; });

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

        // Make sure to create the interactive window after the rebind or it gets the wrong application shell.
        await addCode(getOrCreateNativeEditor, wrapper, 'a=1\na');
        const interactiveWindow = await getOrCreateNativeEditor();

        // Export should cause exportCalled to change to true
        await waitForMessageResponse(() => interactiveWindow.exportCells());
        assert.equal(exportCalled, true, 'Export is not being called during export');

        // Remove the cell
        const exportButton = findButton(wrapper, 5);
        const undo = findButton(wrapper, 2);

        // Now verify if we undo, we have no cells
        const afterUndo = await getCellResults(wrapper, 1, () => {
            undo!.simulate('click');
            return Promise.resolve();
        });

        assert.equal(afterUndo.length, 1, 'Undo should remove cells');

        // Then verify we cannot click the button (it should be disabled)
        exportCalled = false;
        const response = waitForMessageResponse(() => exportButton!.simulate('click'));
        await waitForPromise(response, 100);
        assert.equal(exportCalled, false, 'Export should not be called when no cells visible');

    }, () => { return ioc; });

    runMountedTest('Dispose test', async () => {
        // tslint:disable-next-line:no-any
        const interactiveWindow = await getOrCreateNativeEditor();
        await interactiveWindow.show(); // Have to wait for the load to finish
        await interactiveWindow.dispose();
        // tslint:disable-next-line:no-any
        const h2 = await getOrCreateNativeEditor();
        // Check equal and then dispose so the test goes away
        const equal = Object.is(interactiveWindow, h2);
        await h2.show();
        assert.ok(!equal, 'Disposing is not removing the active interactive window');
    }, () => { return ioc; });


    runMountedTest('Multiple input', async (wrapper) => {
        // Create an interactive window so that it listens to the results.
        const interactiveWindow = await getOrCreateNativeEditor();
        await interactiveWindow.show();

        // Then enter some code.
        await enterInput(wrapper, 'a=1\na');
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);

        // Then delete the node
        const lastCell = getLastOutputCell(wrapper);
        const ImageButtons = lastCell.find(ImageButton);
        assert.equal(ImageButtons.length, 4, 'Cell buttons not found');
        const deleteButton = ImageButtons.at(3);

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
        verifyHtmlOnCell(wrapper, 'hello', CellPosition.Last);
    }, () => { return ioc; });

    runMountedTest('Limit text output', async (wrapper) => {
        ioc.getSettings().datascience.textOutputLimit = 8;

        // Output should be trimmed to just two lines of output
        const code = `print("hello\\nworld\\nhow\\nare\\nyou")`;
        addMockData(ioc, code, 'are\nyou\n');
        await addCode(getOrCreateNativeEditor, wrapper, code, 4);

        verifyHtmlOnCell(wrapper, '>are\nyou', CellPosition.Last);
    }, () => { return ioc; });
});
