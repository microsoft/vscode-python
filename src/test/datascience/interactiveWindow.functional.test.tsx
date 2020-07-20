// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import * as fs from 'fs-extra';
import { parse } from 'node-html-parser';
import * as os from 'os';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Disposable, Memento, Selection, TextDocument, TextEditor, Uri } from 'vscode';

import { ReactWrapper } from 'enzyme';
import { IApplicationShell, IDocumentManager } from '../../client/common/application/types';
import { GLOBAL_MEMENTO, IDataScienceSettings, IMemento } from '../../client/common/types';
import { createDeferred, sleep, waitForPromise } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import { generateCellsFromDocument } from '../../client/datascience/cellFactory';
import { EditorContexts } from '../../client/datascience/constants';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { AskedForPerFileSettingKey } from '../../client/datascience/interactive-window/interactiveWindowProvider';
import { IInteractiveWindowProvider } from '../../client/datascience/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { concatMultilineStringInput } from '../../datascience-ui/common';
import { InteractivePanel } from '../../datascience-ui/history-react/interactivePanel';
import { IKeyboardEvent } from '../../datascience-ui/react-common/event';
import { ImageButton } from '../../datascience-ui/react-common/imageButton';
import { MonacoEditor } from '../../datascience-ui/react-common/monacoEditor';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { createDocument } from './editor-integration/helpers';
import { defaultDataScienceSettings, takeSnapshot, writeDiffSnapshot } from './helpers';
import {
    addCode,
    closeInteractiveWindow,
    createCodeWatcher,
    getInteractiveCellResults,
    getOrCreateInteractiveWindow,
    runCodeLens,
    runTest
} from './interactiveWindowTestHelpers';
import { MockDocumentManager } from './mockDocumentManager';
import { MockEditor } from './mockTextEditor';
import { addCell, createNewEditor } from './nativeEditorTestHelpers';
import {
    addContinuousMockData,
    addInputMockData,
    addMockData,
    CellInputState,
    CellPosition,
    enterEditorKey,
    enterInput,
    escapePath,
    findButton,
    getInteractiveEditor,
    getLastOutputCell,
    srcDirectory,
    submitInput,
    toggleCellExpansion,
    typeCode,
    verifyHtmlOnCell,
    verifyLastCellInputState
} from './testHelpers';
import { ITestInteractiveWindowProvider } from './testInteractiveWindowProvider';

// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
suite('DataScience Interactive Window output tests', () => {
    const disposables: Disposable[] = [];
    let ioc: DataScienceIocContainer;
    const defaultCellMarker = '# %%';
    let snapshot: any;

    suiteSetup(() => {
        snapshot = takeSnapshot();
    });

    setup(async () => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        return ioc.activate();
    });

    suiteTeardown(() => {
        writeDiffSnapshot(snapshot, 'Interactive Window');
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

    async function forceSettingsChange(newSettings: IDataScienceSettings) {
        const { mount } = await getOrCreateInteractiveWindow(ioc);
        const update = mount.waitForMessage(InteractiveWindowMessages.SettingsUpdated);
        ioc.forceSettingsChanged(undefined, ioc.getSettings().pythonPath, newSettings);
        return update;
    }

    function simulateKeyPressOnEditor(
        editorControl: ReactWrapper<any, Readonly<{}>, React.Component> | undefined,
        keyboardEvent: Partial<IKeyboardEvent> & { code: string }
    ) {
        enterEditorKey(editorControl, keyboardEvent);
    }

    function verifyHtmlOnInteractiveCell(html: string | undefined | RegExp, cellIndex: number | CellPosition) {
        const iw = ioc.getInteractiveWebPanel(undefined).wrapper;
        iw.update();
        verifyHtmlOnCell(iw, 'InteractiveCell', html, cellIndex);
    }

    // Uncomment this to debug hangs on exit
    // suiteTeardown(() => {
    //      asyncDump();
    // });

    runTest(
        'Simple text',
        async () => {
            await addCode(ioc, 'a=1\na');

            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Clear output',
        async () => {
            const text = `from IPython.display import clear_output
for i in range(10):
    clear_output()
    print("Hello World {0}!".format(i))
`;
            addContinuousMockData(ioc, text, async (_c) => {
                return {
                    result: 'Hello World 9!',
                    haveMore: false
                };
            });
            await addCode(ioc, text);

            verifyHtmlOnInteractiveCell('<div>Hello World 9!', CellPosition.Last);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Hide inputs',
        async () => {
            await forceSettingsChange({ ...defaultDataScienceSettings(), showCellInputCode: false });

            await addCode(ioc, 'a=1\na');

            verifyLastCellInputState(ioc.getWrapper('interactive'), 'InteractiveCell', CellInputState.Hidden);

            // Add a cell without output, this cell should not show up at all
            addMockData(ioc, 'a=1', undefined, 'text/plain');
            await addCode(ioc, 'a=1');

            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.First);
            verifyHtmlOnInteractiveCell(undefined, CellPosition.Last);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Show inputs',
        async () => {
            await forceSettingsChange({ ...defaultDataScienceSettings() });

            await addCode(ioc, 'a=1\na');

            verifyLastCellInputState(ioc.getWrapper('interactive'), 'InteractiveCell', CellInputState.Visible);
            verifyLastCellInputState(ioc.getWrapper('interactive'), 'InteractiveCell', CellInputState.Collapsed);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Expand inputs',
        async () => {
            await forceSettingsChange({ ...defaultDataScienceSettings(), collapseCellInputCodeByDefault: false });
            await addCode(ioc, 'a=1\na');

            verifyLastCellInputState(ioc.getWrapper('interactive'), 'InteractiveCell', CellInputState.Expanded);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Ctrl + 1/Ctrl + 2',
        async () => {
            // Create an interactive window so that it listens to the results.
            const { mount } = await getOrCreateInteractiveWindow(ioc);

            // Type in the input box
            const editor = getInteractiveEditor(mount.wrapper);
            typeCode(editor, 'a=1\na');

            // Give focus to a random div
            const reactDiv = mount.wrapper.find('div').first().getDOMNode();

            const domDiv = reactDiv.querySelector('div');

            if (domDiv && mount.wrapper) {
                domDiv.tabIndex = -1;
                domDiv.focus();

                // send the ctrl + 1/2 message, this should put focus back on the input box
                mount.postMessage({ type: InteractiveWindowMessages.Activate, payload: undefined });

                // Then enter press shift + enter on the active element
                const activeElement = document.activeElement;
                if (activeElement) {
                    await submitInput(mount, activeElement as HTMLTextAreaElement);
                }
            }

            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Escape/Ctrl+U',
        async () => {
            // Create an interactive window so that it listens to the results.
            const { mount } = await getOrCreateInteractiveWindow(ioc);

            // Type in the input box
            const editor = getInteractiveEditor(mount.wrapper);
            typeCode(editor, 'a=1\na');

            // Check code is what we think it is
            const reactEditor = editor.instance() as MonacoEditor;
            assert.equal(reactEditor.state.model?.getValue().replace(/\r/g, ''), 'a=1\na');

            // Send escape
            simulateKeyPressOnEditor(editor, { code: 'Escape' });
            assert.equal(reactEditor.state.model?.getValue().replace(/\r/g, ''), '');

            typeCode(editor, 'a=1\na');
            assert.equal(reactEditor.state.model?.getValue().replace(/\r/g, ''), 'a=1\na');

            simulateKeyPressOnEditor(editor, { code: 'KeyU', ctrlKey: true });
            assert.equal(reactEditor.state.model?.getValue().replace(/\r/g, ''), '');
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Click outside cells sets focus to input box',
        async () => {
            // Create an interactive window so that it listens to the results.
            const { mount } = await getOrCreateInteractiveWindow(ioc);

            // Type in the input box
            const editor = getInteractiveEditor(mount.wrapper);
            typeCode(editor, 'a=1\na');

            // Give focus to a random div
            const reactDiv = mount.wrapper.find('div').first().getDOMNode();

            const domDiv = reactDiv.querySelector('div');

            if (domDiv) {
                domDiv.tabIndex = -1;
                domDiv.focus();

                mount.wrapper.find('section#main-panel-footer').first().simulate('click');

                // Then enter press shift + enter on the active element
                const activeElement = document.activeElement;
                if (activeElement) {
                    await submitInput(mount, activeElement as HTMLTextAreaElement);
                }
            }

            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Collapse / expand cell',
        async () => {
            await forceSettingsChange({ ...defaultDataScienceSettings() });
            await addCode(ioc, 'a=1\na');
            const wrapper = ioc.getWrapper('interactive');

            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Visible);
            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Collapsed);

            toggleCellExpansion(wrapper, 'InteractiveCell');

            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Visible);
            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Expanded);

            toggleCellExpansion(wrapper, 'InteractiveCell');

            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Visible);
            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Collapsed);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Hide / show cell',
        async () => {
            await forceSettingsChange({ ...defaultDataScienceSettings() });
            await addCode(ioc, 'a=1\na');

            const wrapper = ioc.getWrapper('interactive');
            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Visible);
            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Collapsed);

            // Hide the inputs and verify
            await forceSettingsChange({ ...defaultDataScienceSettings(), showCellInputCode: false });

            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Hidden);

            // Show the inputs and verify
            await forceSettingsChange({ ...defaultDataScienceSettings(), showCellInputCode: true });

            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Visible);
            verifyLastCellInputState(wrapper, 'InteractiveCell', CellInputState.Collapsed);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Mime Types',
        async () => {
            const badPanda = `import pandas as pd
df = pd.read("${escapePath(path.join(srcDirectory(), 'DefaultSalesReport.csv'))}")
df.head()`;
            const goodPanda = `import pandas as pd
df = pd.read_csv("${escapePath(path.join(srcDirectory(), 'DefaultSalesReport.csv'))}")
df.head()`;
            const matPlotLib =
                'import matplotlib.pyplot as plt\r\nimport numpy as np\r\nx = np.linspace(0,20,100)\r\nplt.plot(x, np.sin(x))\r\nplt.show()';
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

            await addCode(ioc, badPanda, true);
            verifyHtmlOnInteractiveCell(`has no attribute 'read'`, CellPosition.Last);

            await addCode(ioc, goodPanda);
            verifyHtmlOnInteractiveCell(`<td>`, CellPosition.Last);

            await addCode(ioc, matPlotLib);
            verifyHtmlOnInteractiveCell(/img|Figure/, CellPosition.Last);

            await addCode(ioc, spinningCursor);
            verifyHtmlOnInteractiveCell('<div>', CellPosition.Last);

            addContinuousMockData(ioc, 'len?', async (_c) => {
                return Promise.resolve({
                    result: `Signature: len(obj, /)
Docstring: Return the number of items in a container.
Type:      builtin_function_or_method`,
                    haveMore: false
                });
            });
            await addCode(ioc, 'len?');
            verifyHtmlOnInteractiveCell('len', CellPosition.Last);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Undo/redo commands',
        async () => {
            const { window } = await getOrCreateInteractiveWindow(ioc);

            // Get a cell into the list
            await addCode(ioc, 'a=1\na');

            // Now verify if we undo, we have no cells
            let afterUndo = await getInteractiveCellResults(
                ioc,
                () => {
                    window.undoCells();
                    return Promise.resolve();
                },
                window
            );

            assert.equal(afterUndo.length, 1, `Undo should remove cells + ${afterUndo.debug()}`);

            // Redo should put the cells back
            const afterRedo = await getInteractiveCellResults(
                ioc,
                () => {
                    window.redoCells();
                    return Promise.resolve();
                },
                window
            );
            assert.equal(afterRedo.length, 2, 'Redo should put cells back');

            // Get another cell into the list
            const afterAdd = await addCode(ioc, 'a=1\na');
            assert.equal(afterAdd.length, 3, 'Second cell did not get added');

            // Clear everything
            const afterClear = await getInteractiveCellResults(ioc, () => {
                window.removeAllCells();
                return Promise.resolve();
            });
            assert.equal(afterClear.length, 1, "Clear didn't work");

            // Undo should put them back
            afterUndo = await getInteractiveCellResults(ioc, () => {
                window.undoCells();
                return Promise.resolve();
            });

            assert.equal(afterUndo.length, 3, `Undo should put cells back`);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Click buttons',
        async () => {
            // Goto source should cause the visible editor to be picked as long as its filename matches
            const showedEditor = createDeferred();
            const textEditors: TextEditor[] = [];
            const docManager = TypeMoq.Mock.ofType<IDocumentManager>();
            const visibleEditor = TypeMoq.Mock.ofType<TextEditor>();
            const dummyDocument = TypeMoq.Mock.ofType<TextDocument>();
            dummyDocument.setup((d) => d.fileName).returns(() => Uri.file('foo.py').fsPath);
            visibleEditor.setup((v) => v.show()).returns(() => showedEditor.resolve());
            visibleEditor.setup((v) => v.revealRange(TypeMoq.It.isAny())).returns(noop);
            visibleEditor.setup((v) => v.document).returns(() => dummyDocument.object);
            textEditors.push(visibleEditor.object);
            docManager.setup((a) => a.visibleTextEditors).returns(() => textEditors);
            ioc.serviceManager.rebindInstance<IDocumentManager>(IDocumentManager, docManager.object);

            // Get a cell into the list
            await addCode(ioc, 'a=1\na');

            // 'Click' the buttons in the react control
            const undo = findButton(ioc.getWrapper('interactive'), InteractivePanel, 2);
            const redo = findButton(ioc.getWrapper('interactive'), InteractivePanel, 1);
            const clear = findButton(ioc.getWrapper('interactive'), InteractivePanel, 0);

            // Now verify if we undo, we have no cells
            let afterUndo = await getInteractiveCellResults(ioc, () => {
                undo!.simulate('click');
                return Promise.resolve();
            });

            assert.equal(afterUndo.length, 1, `Undo should remove cells`);

            // Redo should put the cells back
            const afterRedo = await getInteractiveCellResults(ioc, async () => {
                redo!.simulate('click');
                return Promise.resolve();
            });
            assert.equal(afterRedo.length, 2, 'Redo should put cells back');

            // Get another cell into the list
            const afterAdd = await addCode(ioc, 'a=1\na');
            assert.equal(afterAdd.length, 3, 'Second cell did not get added');

            // Clear everything
            const afterClear = await getInteractiveCellResults(ioc, async () => {
                clear!.simulate('click');
                return Promise.resolve();
            });
            assert.equal(afterClear.length, 1, "Clear didn't work");

            // Undo should put them back
            afterUndo = await getInteractiveCellResults(ioc, async () => {
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
            goto.simulate('click');
            await waitForPromise(showedEditor.promise, 1000);
            assert.ok(showedEditor.resolved, 'Goto source is not jumping to editor');

            // Make sure delete works
            const afterDelete = await getInteractiveCellResults(ioc, async () => {
                deleteButton.simulate('click');
                return Promise.resolve();
            });
            assert.equal(afterDelete.length, 2, `Delete should remove a cell`);
        },
        () => {
            return ioc;
        }
    );

    const interruptCode = `
import time
for i in range(0, 100):
    try:
        time.sleep(0.5)
    except KeyboardInterrupt:
        time.sleep(0.5)`;

    runTest(
        'Interrupt double',
        async () => {
            let interruptedKernel = false;
            const { window, mount } = await getOrCreateInteractiveWindow(ioc);
            window.notebook?.onKernelInterrupted(() => (interruptedKernel = true));

            let timerCount = 0;
            addContinuousMockData(ioc, interruptCode, async (_c) => {
                timerCount += 1;
                await sleep(0.5);
                return Promise.resolve({ result: '', haveMore: timerCount < 100 });
            });

            addMockData(ioc, interruptCode, undefined, 'text/plain');

            // Run the interrupt code and then interrupt it twice to make sure we can interrupt twice
            const waitForAdd = addCode(ioc, interruptCode);

            // 'Click' the button in the react control. We need to verify we can
            // click it more than once.
            const interrupt = findButton(mount.wrapper, InteractivePanel, 4);
            interrupt?.simulate('click');
            await sleep(0.1);
            interrupt?.simulate('click');

            // We should get out of the wait for add
            await waitForAdd;

            // We should have also fired an interrupt
            assert.ok(interruptedKernel, 'Kernel was not interrupted');
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Export',
        async () => {
            // Export should cause the export dialog to come up. Remap appshell so we can check
            const dummyDisposable = {
                dispose: () => {
                    return;
                }
            };
            let exportCalled = false;
            const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            appShell
                .setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString()))
                .returns((e) => {
                    throw e;
                });
            appShell
                .setup((a) => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(''));
            appShell
                .setup((a) => a.showSaveDialog(TypeMoq.It.isAny()))
                .returns(() => {
                    exportCalled = true;
                    return Promise.resolve(undefined);
                });
            appShell.setup((a) => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);
            ioc.serviceManager.rebindInstance<IApplicationShell>(IApplicationShell, appShell.object);

            // Make sure to create the interactive window after the rebind or it gets the wrong application shell.
            await addCode(ioc, 'a=1\na');
            const { window, mount } = await getOrCreateInteractiveWindow(ioc);

            // Export should cause exportCalled to change to true
            const exportPromise = mount.waitForMessage(InteractiveWindowMessages.ReturnAllCells);
            window.exportCells();
            await exportPromise;
            await sleep(100); // Give time for appshell to come up
            assert.equal(exportCalled, true, 'Export is not being called during export');

            // Remove the cell
            const exportButton = findButton(mount.wrapper, InteractivePanel, 6);
            const undo = findButton(mount.wrapper, InteractivePanel, 2);

            // Now verify if we undo, we have no cells
            const afterUndo = await getInteractiveCellResults(ioc, () => {
                undo!.simulate('click');
                return Promise.resolve();
            });

            assert.equal(afterUndo.length, 1, 'Undo should remove cells');

            // Then verify we cannot click the button (it should be disabled)
            exportCalled = false;
            exportButton!.simulate('click');
            await sleep(100);
            assert.equal(exportCalled, false, 'Export should not be called when no cells visible');
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Multiple Interpreters',
        async (context) => {
            if (!ioc.mockJupyter) {
                const interactiveWindowProvider = ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
                const interpreterService = ioc.get<IInterpreterService>(IInterpreterService);
                const interpreters = await ioc.getFunctionalTestInterpreters();
                if (interpreters.length < 2) {
                    // tslint:disable-next-line: no-console
                    console.log(
                        'Multiple interpreters skipped because local machine does not have more than one jupyter environment'
                    );
                    context.skip();
                    return;
                }
                const window = (await interactiveWindowProvider.getOrCreate(undefined)) as InteractiveWindow;
                await addCode(ioc, 'a=1\na');
                const activeInterpreter = await interpreterService.getActiveInterpreter(window.owningResource);
                verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);
                assert.equal(
                    window.notebook!.getMatchingInterpreter()?.path,
                    activeInterpreter?.path,
                    'Active intrepreter not used to launch notebook'
                );
                await closeInteractiveWindow(ioc, window);

                // Add another python path
                const secondUri = Uri.file('bar.py');
                ioc.addResourceToFolder(secondUri, path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience2'));
                ioc.forceSettingsChanged(
                    secondUri,
                    interpreters.filter((i) => i.path !== activeInterpreter?.path)[0].path
                );

                // Then open a second time and make sure it uses this new path
                const newWindow = (await interactiveWindowProvider.getOrCreate(undefined)) as InteractiveWindow;
                await addCode(ioc, 'a=1\na', false, secondUri);
                assert.notEqual(
                    newWindow.notebook!.getMatchingInterpreter()?.path,
                    activeInterpreter?.path,
                    'Active intrepreter used to launch second notebook when it should not have'
                );
                verifyHtmlOnCell(ioc.getWrapper('interactive'), 'InteractiveCell', '<span>1</span>', CellPosition.Last);
            } else {
                context.skip();
            }
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Dispose test',
        async () => {
            // tslint:disable-next-line:no-any
            const { window } = await getOrCreateInteractiveWindow(ioc);
            await window.dispose();
            // tslint:disable-next-line:no-any
            const h2 = await getOrCreateInteractiveWindow(ioc);
            // Check equal and then dispose so the test goes away
            const equal = Object.is(window, h2.window);
            assert.ok(!equal, 'Disposing is not removing the active interactive window');
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Editor Context',
        async () => {
            // Before we have any cells, verify our contexts are not set
            assert.equal(
                ioc.getContext(EditorContexts.HaveInteractive),
                false,
                'Should not have interactive before starting'
            );
            assert.equal(
                ioc.getContext(EditorContexts.HaveInteractiveCells),
                false,
                'Should not have interactive cells before starting'
            );
            assert.equal(
                ioc.getContext(EditorContexts.HaveRedoableCells),
                false,
                'Should not have redoable before starting'
            );

            // Verify we can send different commands to the UI and it will respond
            const { window, mount } = await getOrCreateInteractiveWindow(ioc);

            // Get an update promise so we can wait for the add code
            const updatePromise = mount.waitForMessage(InteractiveWindowMessages.ExecutionRendered);

            // Send some code to the interactive window
            await window.addCode('a=1\na', Uri.file('foo.py'), 2);

            // Wait for the render to go through
            await updatePromise;

            // Now we should have the 3 editor contexts
            assert.equal(
                ioc.getContext(EditorContexts.HaveInteractive),
                true,
                'Should have interactive after starting'
            );
            assert.equal(
                ioc.getContext(EditorContexts.HaveInteractiveCells),
                true,
                'Should have interactive cells after starting'
            );
            assert.equal(
                ioc.getContext(EditorContexts.HaveRedoableCells),
                false,
                'Should not have redoable after starting'
            );

            // Setup a listener for context change events. We have 3 separate contexts, so we have to wait for all 3.
            let count = 0;
            let deferred = createDeferred<boolean>();
            const eventDispose = ioc.onContextSet((_a) => {
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
            window.undoCells();
            await waitForPromise(deferred.promise, 2000);
            assert.ok(deferred.resolved, 'Never got update to state');
            assert.equal(
                ioc.getContext(EditorContexts.HaveInteractiveCells),
                false,
                'Should not have interactive cells after undo as sysinfo is ignored'
            );
            assert.equal(ioc.getContext(EditorContexts.HaveRedoableCells), true, 'Should have redoable after undo');

            resetWaiting();
            window.redoCells();
            await waitForPromise(deferred.promise, 2000);
            assert.ok(deferred.resolved, 'Never got update to state');
            assert.equal(
                ioc.getContext(EditorContexts.HaveInteractiveCells),
                true,
                'Should have interactive cells after redo'
            );
            assert.equal(
                ioc.getContext(EditorContexts.HaveRedoableCells),
                false,
                'Should not have redoable after redo'
            );

            resetWaiting();
            window.removeAllCells();
            await waitForPromise(deferred.promise, 2000);
            assert.ok(deferred.resolved, 'Never got update to state');
            assert.equal(
                ioc.getContext(EditorContexts.HaveInteractiveCells),
                false,
                'Should not have interactive cells after delete'
            );
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Simple input',
        async () => {
            // Create an interactive window so that it listens to the results.
            const { mount } = await getOrCreateInteractiveWindow(ioc);

            // Then enter some code.
            await enterInput(mount, 'a=1\na', 'InteractiveCell');
            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Copy to source input',
        async () => {
            const showedEditor = createDeferred();
            ioc.addDocument('# No cells here', 'foo.py');
            const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
            const editor = (await docManager.showTextDocument(docManager.textDocuments[0])) as MockEditor;
            editor.setRevealCallback(() => showedEditor.resolve());

            // Create an interactive window so that it listens to the results.
            const { mount } = await getOrCreateInteractiveWindow(ioc);

            // Then enter some code.
            await enterInput(mount, 'a=1\na', 'InteractiveCell');
            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);
            const ImageButtons = getLastOutputCell(mount.wrapper, 'InteractiveCell').find(ImageButton);
            assert.equal(ImageButtons.length, 4, 'Cell buttons not found');
            const copyToSource = ImageButtons.at(2);

            // Then click the copy to source button
            copyToSource.simulate('click');
            await waitForPromise(showedEditor.promise, 100);
            assert.ok(showedEditor.resolved, 'Copy to source is not adding code to the editor');
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Multiple input',
        async () => {
            // Create an interactive window so that it listens to the results.
            const { mount } = await getOrCreateInteractiveWindow(ioc);

            // Then enter some code.
            await enterInput(mount, 'a=1\na', 'InteractiveCell');
            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);

            // Then delete the node
            const lastCell = getLastOutputCell(mount.wrapper, 'InteractiveCell');
            const ImageButtons = lastCell.find(ImageButton);
            assert.equal(ImageButtons.length, 4, 'Cell buttons not found');
            const deleteButton = ImageButtons.at(3);

            // Make sure delete works
            const afterDelete = await getInteractiveCellResults(ioc, async () => {
                deleteButton.simulate('click');
                return Promise.resolve();
            });
            assert.equal(afterDelete.length, 1, `Delete should remove a cell`);

            // Should be able to enter again
            await enterInput(mount, 'a=1\na', 'InteractiveCell');
            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);

            // Try a 3rd time with some new input
            addMockData(ioc, 'print("hello")', 'hello');
            await enterInput(mount, 'print("hello', 'InteractiveCell');
            verifyHtmlOnInteractiveCell('hello', CellPosition.Last);

            // Verify auto indent is working
            const editor = getInteractiveEditor(mount.wrapper);
            typeCode(editor, 'if (True):\n');
            typeCode(editor, 'print("true")');
            const reactEditor = editor.instance() as MonacoEditor;
            assert.equal(reactEditor.state.model?.getValue().replace(/\r/g, ''), `if (True):\n    print("true")`);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Restart with session failure',
        async () => {
            // Prime the pump
            await addCode(ioc, 'a=1\na');
            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);

            // Then something that could possibly timeout
            addContinuousMockData(ioc, 'import time\r\ntime.sleep(1000)', (_c) => {
                return Promise.resolve({ result: '', haveMore: true });
            });

            // Then get our mock session and force it to not restart ever.
            if (ioc.mockJupyter) {
                const currentSession = ioc.mockJupyter.getCurrentSession();
                if (currentSession) {
                    currentSession.prolongRestarts();
                }
            }

            // Then try executing our long running cell and restarting in the middle
            const { window } = await getOrCreateInteractiveWindow(ioc);
            const executed = createDeferred();
            // We have to wait until the execute goes through before we reset.
            window.onExecutedCode(() => executed.resolve());
            const added = window.addCode('import time\r\ntime.sleep(1000)', Uri.file('foo'), 0);
            await executed.promise;
            await window.restartKernel();
            await added;

            // Now see if our wrapper still works. Interactive window should have forced a restart
            await window.addCode('a=1\na', Uri.file('foo'), 0);
            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'LiveLossPlot',
        async () => {
            // Only run this test when not mocking. Too complicated to mimic otherwise
            if (!ioc.mockJupyter) {
                // Load all of our cells
                const testFile = path.join(srcDirectory(), 'liveloss.py');
                const version = 1;
                const inputText = await fs.readFile(testFile, 'utf-8');
                const document = createDocument(inputText, testFile, version, TypeMoq.Times.atLeastOnce(), true);
                const cells = generateCellsFromDocument(document.object);
                assert.ok(cells, 'No cells generated');
                assert.equal(cells.length, 2, 'Not enough cells generated');

                // Run the first cell
                await addCode(ioc, concatMultilineStringInput(cells[0].data.source));

                // Last cell should generate a series of updates. Verify we end up with a single image
                await addCode(ioc, concatMultilineStringInput(cells[1].data.source));
                const cell = getLastOutputCell(ioc.getInteractiveWebPanel(undefined).wrapper, 'InteractiveCell');

                const output = cell!.find('div.cell-output');
                assert.ok(output.length > 0, 'No output cell found');
                const outHtml = output.html();

                const root = parse(outHtml) as any;
                const png = root.querySelectorAll('img') as HTMLElement[];
                assert.ok(png, 'No pngs found');
                assert.equal(png.length, 1, 'Wrong number of pngs');
            }
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Gather code run from text editor',
        async () => {
            ioc.getSettings().datascience.gatherToScript = true;
            // Enter some code.
            const code = `${defaultCellMarker}\na=1\na`;
            await addCode(ioc, code);
            addMockData(ioc, code, undefined);
            const mount = ioc.getInteractiveWebPanel(undefined);
            const ImageButtons = getLastOutputCell(mount.wrapper, 'InteractiveCell').find(ImageButton); // This isn't rendering correctly
            assert.equal(ImageButtons.length, 4, 'Cell buttons not found');
            const gatherCode = ImageButtons.at(0);

            // Then click the gather code button
            const gatherPromise = mount.waitForMessage(InteractiveWindowMessages.GatherCodeToScript);
            gatherCode.simulate('click');
            await gatherPromise;
            const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
            assert.notEqual(docManager.activeTextEditor, undefined);
            if (docManager.activeTextEditor) {
                assert.notEqual(
                    docManager.activeTextEditor.document
                        .getText()
                        .trim()
                        .search('# This file was generated by the Gather Extension'),
                    -1
                );

                // Basic unit test does not need to have Gather available in the build.
                assert.notEqual(
                    docManager.activeTextEditor.document.getText().trim().search('Gather internal error'),
                    -1
                );
            }
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Gather code run from input box',
        async () => {
            ioc.getSettings().datascience.gatherToScript = true;
            // Create an interactive window so that it listens to the results.
            const { mount } = await getOrCreateInteractiveWindow(ioc);

            // Then enter some code.
            await enterInput(mount, 'a=1\na', 'InteractiveCell');
            verifyHtmlOnInteractiveCell('<span>1</span>', CellPosition.Last);
            const ImageButtons = getLastOutputCell(mount.wrapper, 'InteractiveCell').find(ImageButton);
            assert.equal(ImageButtons.length, 4, 'Cell buttons not found');
            const gatherCode = ImageButtons.at(0);

            // Then click the gather code button
            const gatherPromise = mount.waitForMessage(InteractiveWindowMessages.GatherCodeToScript);
            gatherCode.simulate('click');
            await gatherPromise;
            const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
            assert.notEqual(docManager.activeTextEditor, undefined);

            if (docManager.activeTextEditor) {
                // Just check key parts of the document, not the whole thing.
                assert.notEqual(
                    docManager.activeTextEditor.document
                        .getText()
                        .trim()
                        .search('# This file was generated by the Gather Extension'),
                    -1
                );

                // Basic unit test does not need to have Gather available in the build.
                assert.notEqual(
                    docManager.activeTextEditor.document.getText().trim().search('Gather internal error'),
                    -1
                );
            }
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Copy back to source',
        async (_wrapper) => {
            ioc.addDocument(`${defaultCellMarker}${os.EOL}print("bar")`, 'foo.py');
            const docManager = ioc.get<IDocumentManager>(IDocumentManager);
            docManager.showTextDocument(docManager.textDocuments[0]);
            const { window } = await getOrCreateInteractiveWindow(ioc);
            const interactiveWindow = window as InteractiveWindow;
            await interactiveWindow.copyCode({ source: 'print("baz")' });
            assert.equal(
                docManager.textDocuments[0].getText(),
                `${defaultCellMarker}${os.EOL}print("baz")${os.EOL}${defaultCellMarker}${os.EOL}print("bar")`,
                'Text not inserted'
            );
            const activeEditor = docManager.activeTextEditor as MockEditor;
            activeEditor.selection = new Selection(1, 2, 1, 2);
            await interactiveWindow.copyCode({ source: 'print("baz")' });
            assert.equal(
                docManager.textDocuments[0].getText(),
                `${defaultCellMarker}${os.EOL}${defaultCellMarker}${os.EOL}print("baz")${os.EOL}${defaultCellMarker}${os.EOL}print("baz")${os.EOL}${defaultCellMarker}${os.EOL}print("bar")`,
                'Text not inserted'
            );
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Limit text output',
        async () => {
            ioc.getSettings().datascience.textOutputLimit = 8;

            // Output should be trimmed to just two lines of output
            const code = `print("hello\\nworld\\nhow\\nare\\nyou")`;
            addMockData(ioc, code, 'are\nyou\n');
            await addCode(ioc, code);

            verifyHtmlOnInteractiveCell('>are\nyou', CellPosition.Last);
        },
        () => {
            return ioc;
        }
    );

    runTest(
        'Type in input',
        async () => {
            const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            appShell
                .setup((a) => a.showInputBox(TypeMoq.It.isAny()))
                .returns(() => {
                    return Promise.resolve('typed input');
                });
            ioc.serviceManager.rebindInstance<IApplicationShell>(IApplicationShell, appShell.object);

            // Send in some special input
            const code = `b = input('Test')\nb`;
            addInputMockData(ioc, code, 'typed input');
            await addCode(ioc, code);

            verifyHtmlOnInteractiveCell('typed input', CellPosition.Last);
        },
        () => {
            return ioc;
        }
    );
    runTest(
        'Update display data',
        async (context) => {
            if (ioc.mockJupyter) {
                context.skip();
            } else {
                // Create 3 cells. Last cell should update the second
                await addCode(ioc, 'dh = display(display_id=True)');
                await addCode(ioc, 'dh.display("Hello")');
                verifyHtmlOnInteractiveCell('Hello', CellPosition.Last);
                await addCode(ioc, 'dh.update("Goodbye")');
                verifyHtmlOnInteractiveCell('<div></div>', CellPosition.Last);
                verifyHtmlOnInteractiveCell('Goodbye', 1);
            }
        },
        () => {
            return ioc;
        }
    );

    test('Open notebook and interactive at the same time', async () => {
        addMockData(ioc, 'a=1\na', 1, 'text/plain');
        addMockData(ioc, 'b=2\nb', 2, 'text/plain');

        // Mount two different webviews
        const ne = await createNewEditor(ioc);
        let iw = await getOrCreateInteractiveWindow(ioc);

        // Run code in both
        await addCode(ioc, 'a=1\na');
        await addCell(ne.mount, 'a=1\na', true);

        // Make sure both are correct
        verifyHtmlOnCell(iw.mount.wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);
        verifyHtmlOnCell(ne.mount.wrapper, 'NativeCell', '<span>1</span>', CellPosition.Last);

        // Close the interactive editor.
        await closeInteractiveWindow(ioc, iw.window);

        // Run another cell and make sure it works in the notebook
        await addCell(ne.mount, 'b=2\nb', true);
        verifyHtmlOnCell(ne.mount.wrapper, 'NativeCell', '<span>2</span>', CellPosition.Last);

        // Rerun the interactive window
        iw = await getOrCreateInteractiveWindow(ioc);
        await addCode(ioc, 'a=1\na');

        verifyHtmlOnCell(iw.mount.wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);
    });
    test('Multiple interactive windows', async () => {
        ioc.forceDataScienceSettingsChanged({ interactiveWindowMode: 'multiple' });
        const pair1 = await getOrCreateInteractiveWindow(ioc);
        const pair2 = await getOrCreateInteractiveWindow(ioc);
        assert.notEqual(pair1.window.title, pair2.window.title, 'Two windows were not created.');
        assert.notEqual(pair1.mount.wrapper, pair2.mount.wrapper, 'Two windows were not created.');
    });
    const fooCode = `x = 'foo'\nx`;
    const barCode = `y = 'bar'\ny`;
    test('Multiple executes go to last active window', async () => {
        addMockData(ioc, fooCode, 'foo');
        addMockData(ioc, barCode, 'bar');

        ioc.forceDataScienceSettingsChanged({ interactiveWindowMode: 'multiple' });
        const globalMemento = ioc.get<Memento>(IMemento, GLOBAL_MEMENTO);
        await globalMemento.update(AskedForPerFileSettingKey, true);

        const pair1 = await getOrCreateInteractiveWindow(ioc);

        // Run a cell from a document
        const fooWatcher = createCodeWatcher(`# %%\n${fooCode}`, 'foo.py', ioc);
        const lenses = fooWatcher?.getCodeLenses();
        assert.equal(lenses?.length, 6, 'No code lenses found');
        await runCodeLens(fooWatcher!.uri!, lenses ? lenses[0] : undefined, ioc);
        verifyHtmlOnCell(pair1.mount.wrapper, 'InteractiveCell', '<span>foo</span>', CellPosition.Last);

        // Create another window, run a cell again
        const pair2 = await getOrCreateInteractiveWindow(ioc);
        await runCodeLens(fooWatcher!.uri!, lenses ? lenses[0] : undefined, ioc);
        verifyHtmlOnCell(pair2.mount.wrapper, 'InteractiveCell', '<span>foo</span>', CellPosition.Last);

        // Make the first window active
        pair2.mount.changeViewState(false, false);
        pair1.mount.changeViewState(true, true);

        // Run another file
        const barWatcher = createCodeWatcher(`# %%\n${barCode}`, 'bar.py', ioc);
        const lenses2 = barWatcher?.getCodeLenses();
        assert.equal(lenses2?.length, 6, 'No code lenses found');
        await runCodeLens(barWatcher!.uri!, lenses2 ? lenses2[0] : undefined, ioc);
        verifyHtmlOnCell(pair1.mount.wrapper, 'InteractiveCell', '<span>bar</span>', CellPosition.Last);
    });
    test('Per file', async () => {
        addMockData(ioc, fooCode, 'foo');
        addMockData(ioc, barCode, 'bar');
        ioc.forceDataScienceSettingsChanged({ interactiveWindowMode: 'perFile' });
        const interactiveWindowProvider = ioc.get<ITestInteractiveWindowProvider>(IInteractiveWindowProvider);

        // Run a cell from a document
        const fooWatcher = createCodeWatcher(`# %%\n${fooCode}`, 'foo.py', ioc);
        const lenses = fooWatcher?.getCodeLenses();
        assert.equal(lenses?.length, 6, 'No code lenses found');
        await runCodeLens(fooWatcher!.uri!, lenses ? lenses[0] : undefined, ioc);
        assert.equal(interactiveWindowProvider.windows.length, 1, 'Interactive window not created');
        const mounted1 = interactiveWindowProvider.getMountedWebView(interactiveWindowProvider.windows[0]);
        verifyHtmlOnCell(mounted1.wrapper, 'InteractiveCell', '<span>foo</span>', CellPosition.Last);

        // Create another window, run a cell again
        const barWatcher = createCodeWatcher(`# %%\n${barCode}`, 'bar.py', ioc);
        const lenses2 = barWatcher?.getCodeLenses();
        await runCodeLens(barWatcher!.uri!, lenses2 ? lenses2[0] : undefined, ioc);
        assert.equal(interactiveWindowProvider.windows.length, 2, 'Interactive window not created');
        const mounted2 = interactiveWindowProvider.getMountedWebView(
            interactiveWindowProvider.windows.find((w) => w.title.includes('bar'))
        );
        verifyHtmlOnCell(mounted2.wrapper, 'InteractiveCell', '<span>bar</span>', CellPosition.Last);
    });
    test('Per file asks and changes titles', async () => {
        addMockData(ioc, fooCode, 'foo');
        addMockData(ioc, barCode, 'bar');
        ioc.applicationShell
            .setup((i) => i.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((_a1: string, a2: string, _a3: string) => {
                return Promise.resolve(a2);
            });
        ioc.forceDataScienceSettingsChanged({ interactiveWindowMode: 'multiple' });
        const interactiveWindowProvider = ioc.get<ITestInteractiveWindowProvider>(IInteractiveWindowProvider);
        const globalMemento = ioc.get<Memento>(IMemento, GLOBAL_MEMENTO);
        await globalMemento.update(AskedForPerFileSettingKey, false);

        // Run a cell from a document
        const fooWatcher = createCodeWatcher(`# %%\n${fooCode}`, 'foo.py', ioc);
        const lenses = fooWatcher?.getCodeLenses();
        assert.equal(lenses?.length, 6, 'No code lenses found');
        await runCodeLens(fooWatcher!.uri!, lenses ? lenses[0] : undefined, ioc);
        assert.equal(interactiveWindowProvider.windows.length, 1, 'Interactive window not created');
        const mounted1 = interactiveWindowProvider.getMountedWebView(interactiveWindowProvider.windows[0]);
        verifyHtmlOnCell(mounted1.wrapper, 'InteractiveCell', '<span>foo</span>', CellPosition.Last);

        // Create another window, run a cell again
        const barWatcher = createCodeWatcher(`# %%\n${barCode}`, 'bar.py', ioc);
        const lenses2 = barWatcher?.getCodeLenses();
        await runCodeLens(barWatcher!.uri!, lenses2 ? lenses2[0] : undefined, ioc);
        assert.equal(interactiveWindowProvider.windows.length, 2, 'Interactive window not created');
        const mounted2 = interactiveWindowProvider.getMountedWebView(
            interactiveWindowProvider.windows.find((w) => w.title.includes('bar'))
        );
        verifyHtmlOnCell(mounted2.wrapper, 'InteractiveCell', '<span>bar</span>', CellPosition.Last);

        // First window should now have foo in the title too
        assert.ok(interactiveWindowProvider.windows[0].title.includes('foo'), 'Title of first window did not change');
    });
});
