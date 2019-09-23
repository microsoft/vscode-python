// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Disposable, TextDocument, TextEditor, Uri } from 'vscode';

import { IApplicationShell, IDocumentManager } from '../../client/common/application/types';
import { createDeferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { INotebookEditor, INotebookEditorProvider } from '../../client/datascience/types';
import { NativeEditor } from '../../datascience-ui/native-editor/nativeEditor';
import { ImageButton } from '../../datascience-ui/react-common/imageButton';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { addCell, getNativeCellResults, runMountedTest } from './nativeEditorTestHelpers';
import {
    addContinuousMockData,
    addMockData,
    CellPosition,
    escapePath,
    findButton,
    getLastOutputCell,
    srcDirectory,
    verifyHtmlOnCell
} from './testHelpers';

//import { asyncDump } from '../common/asyncDump';
// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
suite('DataScience Native Editor tests', () => {
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
        const notebookProvider = ioc.get<INotebookEditorProvider>(INotebookEditorProvider);
        if (uri && contents) {
            return notebookProvider.open(uri, contents);
        } else {
            return notebookProvider.createNew();
        }
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

    runMountedTest('Simple text', async (wrapper) => {
        // Create an editor so something is listening to messages
        await createNewEditor();

        // Add a cell into the UI and wait for it to render
        await addCell(wrapper, 'a=1\na');

        verifyHtmlOnCell(wrapper, 'NativeCell', '<span>1</span>', CellPosition.Last);
    }, () => { return ioc; });

    runMountedTest('Mime Types', async (wrapper) => {
        // Create an editor so something is listening to messages
        await createNewEditor();

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

        await addCell(wrapper, badPanda, 5);
        verifyHtmlOnCell(wrapper, 'NativeCell', `has no attribute 'read'`, CellPosition.Last);

        await addCell(wrapper, goodPanda, 5);
        verifyHtmlOnCell(wrapper, 'NativeCell', `<td>`, CellPosition.Last);

        await addCell(wrapper, matPlotLib, 5);
        verifyHtmlOnCell(wrapper, 'NativeCell', matPlotLibResults, CellPosition.Last);

        await addCell(wrapper, spinningCursor, 4 + (ioc.mockJupyter ? (cursors.length * 3) : 0));
        verifyHtmlOnCell(wrapper, 'NativeCell', '<div>', CellPosition.Last);
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
        // Create an editor so something is listening to messages
        await createNewEditor();

        // Get a cell into the list
        await addCell(wrapper, 'a=1\na');

        // find the buttons on the cell itself
        const cell = getLastOutputCell(wrapper, 'NativeCell');
        const ImageButtons = cell.find(ImageButton);
        assert.equal(ImageButtons.length, 7, 'Cell buttons not found');
        const deleteButton = ImageButtons.at(6);

        // Make sure delete works
        const afterDelete = await getNativeCellResults(wrapper, 1, async () => {
            deleteButton.simulate('click');
            return Promise.resolve();
        });
        assert.equal(afterDelete.length, 0, `Delete should remove a cell`);
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
        await createNewEditor();
        await addCell(wrapper, 'a=1\na');

        // Export should cause exportCalled to change to true
        const exportButton = findButton(wrapper, NativeEditor, 5);
        await waitForMessageResponse(() => exportButton!.simulate('click'));
        assert.equal(exportCalled, true, 'Export should have been called');
    }, () => { return ioc; });
});
