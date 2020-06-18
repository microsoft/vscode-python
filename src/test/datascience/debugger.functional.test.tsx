// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import * as uuid from 'uuid/v4';
import { CodeLens, Disposable, Position, Range, SourceBreakpoint, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';

import { expect } from 'chai';
import { IApplicationShell, IDocumentManager } from '../../client/common/application/types';
import { RunByLine } from '../../client/common/experiments/groups';
import { createDeferred, waitForPromise } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import { Commands, Identifiers } from '../../client/datascience/constants';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import {
    IDataScienceCodeLensProvider,
    IDebugLocationTracker,
    IInteractiveWindowProvider,
    IJupyterDebugService,
    IJupyterExecution
} from '../../client/datascience/types';
import { DebugState } from '../../datascience-ui/interactive-common/mainState';
import { ImageButton } from '../../datascience-ui/react-common/imageButton';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { takeSnapshot, writeDiffSnapshot } from './helpers';
import { getInteractiveCellResults, getOrCreateInteractiveWindow } from './interactiveWindowTestHelpers';
import { MockDocument } from './mockDocument';
import { MockDocumentManager } from './mockDocumentManager';
import { addCell, createNewEditor } from './nativeEditorTestHelpers';
import {
    getLastOutputCell,
    openVariableExplorer,
    runInteractiveTest,
    runNativeTest,
    waitForMessage
} from './testHelpers';
import { verifyVariables } from './variableTestHelpers';

//import { asyncDump } from '../common/asyncDump';
// tslint:disable-next-line:max-func-body-length no-any
suite('DataScience Debugger tests', () => {
    const disposables: Disposable[] = [];
    const postDisposables: Disposable[] = [];
    let ioc: DataScienceIocContainer;
    let lastErrorMessage: string | undefined;
    let jupyterDebuggerService: IJupyterDebugService | undefined;
    // tslint:disable-next-line: no-any
    let snapshot: any;

    suiteSetup(function () {
        snapshot = takeSnapshot();

        // Debugger tests require jupyter to run. Othewrise can't not really testing them
        const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;

        if (!isRollingBuild) {
            // tslint:disable-next-line:no-console
            console.log('Skipping Debugger tests. Requires python environment');
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });

    suiteTeardown(() => {
        writeDiffSnapshot(snapshot, 'Debugger');
    });

    setup(async () => {
        ioc = new DataScienceIocContainer();
    });

    async function createIOC() {
        ioc.registerDataScienceTypes();
        jupyterDebuggerService = ioc.serviceManager.get<IJupyterDebugService>(
            IJupyterDebugService,
            Identifiers.MULTIPLEXING_DEBUGSERVICE
        );
        // Rebind the appshell so we can change what happens on an error
        const dummyDisposable = {
            dispose: () => {
                return;
            }
        };
        const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        appShell.setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString())).returns((e) => (lastErrorMessage = e));
        appShell
            .setup((a) => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(''));
        appShell
            .setup((a) => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((_a1: string, a2: string, _a3: string) => Promise.resolve(a2));
        appShell
            .setup((a) => a.showSaveDialog(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(Uri.file('test.ipynb')));
        appShell.setup((a) => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);

        ioc.serviceManager.rebindInstance<IApplicationShell>(IApplicationShell, appShell.object);

        // Make sure the history provider and execution factory in the container is created (the extension does this on startup in the extension)
        // This is necessary to get the appropriate live share services up and running.
        ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
        ioc.get<IJupyterExecution>(IJupyterExecution);
        ioc.get<IDebugLocationTracker>(IDebugLocationTracker);

        await ioc.activate();
        return ioc;
    }

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
        lastErrorMessage = undefined;
        for (const disposable of postDisposables) {
            if (!disposable) {
                continue;
            }
            // tslint:disable-next-line:no-any
            const promise = disposable.dispose() as Promise<any>;
            if (promise) {
                await promise;
            }
        }
    });

    suiteTeardown(() => {
        //        asyncDump();
    });

    async function debugCell(
        type: 'notebook' | 'default',
        code: string,
        breakpoint?: Range,
        breakpointFile?: string,
        expectError?: boolean,
        stepAndVerify?: () => void
    ): Promise<void> {
        // Create a dummy document with just this code
        const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
        const fileName = path.join(EXTENSION_ROOT_DIR, 'foo.py');
        docManager.addDocument(code, fileName);

        if (breakpoint) {
            const sourceFile = breakpointFile ? path.join(EXTENSION_ROOT_DIR, breakpointFile) : fileName;
            const sb: SourceBreakpoint = {
                location: {
                    uri: Uri.file(sourceFile),
                    range: breakpoint
                },
                id: uuid(),
                enabled: true
            };
            jupyterDebuggerService!.addBreakpoints([sb]);
        }

        // Start the jupyter server
        const history = await getOrCreateInteractiveWindow(ioc);

        const expectedBreakLine = breakpoint && !breakpointFile ? breakpoint.start.line : 2; // 2 because of the 'breakpoint()' that gets added

        // Debug this code. We should either hit the breakpoint or stop on entry
        const resultPromise = getInteractiveCellResults(ioc, ioc.getWebPanel(type).wrapper, async () => {
            let breakPromise = createDeferred<void>();

            // Make sure that our code lens provider has signaled a change before we check the lenses
            let newLensPromise = createDeferred<void>();
            let newLensDispose;
            const codeLensProvider = ioc.serviceManager.get<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider);
            if (codeLensProvider.onDidChangeCodeLenses) {
                newLensDispose = codeLensProvider.onDidChangeCodeLenses(() => newLensPromise.resolve());
            }

            disposables.push(jupyterDebuggerService!.onBreakpointHit(() => breakPromise.resolve()));
            const done = history.debugCode(code, fileName, 0, docManager.activeTextEditor);
            await waitForPromise(Promise.race([done, breakPromise.promise]), 60000);
            if (expectError) {
                assert.ok(lastErrorMessage, 'Error did not occur when expected');
                throw Error('Exiting cell results');
            } else {
                assert.ok(breakPromise.resolved, 'Breakpoint event did not fire');
                assert.ok(!lastErrorMessage, `Error occurred ${lastErrorMessage}`);
                const stackFrames = await jupyterDebuggerService!.getStack();
                assert.ok(stackFrames, 'Stack trace not computable');
                assert.ok(stackFrames.length >= 1, 'Not enough frames');
                assert.equal(stackFrames[0].line, expectedBreakLine, 'Stopped on wrong line number');

                await waitForPromise(newLensPromise.promise, 10_000);

                verifyCodeLenses(expectedBreakLine);
                newLensDispose?.dispose();

                // Step if allowed
                if (stepAndVerify && ioc.getDefaultWrapper() && !ioc.mockJupyter) {
                    // Verify variables work
                    openVariableExplorer(ioc.getDefaultWrapper());
                    breakPromise = createDeferred<void>();
                    await jupyterDebuggerService?.step();
                    await breakPromise.promise;
                    await waitForMessage(ioc, InteractiveWindowMessages.VariablesComplete);
                    const variableRefresh = waitForMessage(ioc, InteractiveWindowMessages.VariablesComplete);
                    await jupyterDebuggerService?.requestVariables();
                    await variableRefresh;

                    // Force an update so we render whatever the current state is
                    ioc.getDefaultWrapper().update();

                    // Then verify results.
                    stepAndVerify();
                }

                newLensPromise = createDeferred<void>();
                if (codeLensProvider.onDidChangeCodeLenses) {
                    newLensDispose = codeLensProvider.onDidChangeCodeLenses(() => newLensPromise.resolve());
                }

                // Verify break location
                await jupyterDebuggerService!.continue();

                await waitForPromise(newLensPromise.promise, 10_000);

                verifyCodeLenses(undefined);
                newLensDispose?.dispose();
            }
        });

        if (!expectError) {
            const cellResults = await resultPromise;
            assert.ok(cellResults, 'No cell results after finishing debugging');
        } else {
            try {
                await resultPromise;
            } catch {
                noop();
            }
        }
        await history.dispose();
    }

    function verifyCodeLenses(expectedBreakLine: number | undefined) {
        // We should have three debug code lenses which should all contain the break line
        const codeLenses = getCodeLenses();

        if (expectedBreakLine) {
            assert.equal(codeLenses.length, 3, 'Incorrect number of debug code lenses stop');
            expect(codeLenses[0].command!.command).to.be.equal(Commands.DebugContinue);
            expect(codeLenses[1].command!.command).to.be.equal(Commands.DebugStop);
            expect(codeLenses[2].command!.command).to.be.equal(Commands.DebugStepOver);
            codeLenses.forEach((codeLens) => {
                assert.ok(codeLens.range.contains(new Position(expectedBreakLine - 1, 0)));
            });
        } else {
            // Two options, either we are in Debug-Run mode and expect no lenses.
            // Or we are in Design mode and expect run - run below - debug cell - goto
            if (codeLenses.length !== 4) {
                assert.equal(codeLenses.length, 0, 'Incorrect number of debug code lenses debug - run');
            } else {
                assert.equal(codeLenses.length, 4, 'Incorrect number of debug code lenses design after debug');
                expect(codeLenses[0].command!.command).to.be.equal(Commands.RunCell);
                expect(codeLenses[1].command!.command).to.be.equal(Commands.RunCellAndAllBelow);
                expect(codeLenses[2].command!.command).to.be.equal(Commands.DebugCell);
                expect(codeLenses[3].command!.command).to.be.equal(Commands.ScrollToCell);
            }
        }
    }

    function getCodeLenses(): CodeLens[] {
        const documentManager = ioc.serviceManager.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
        const codeLensProvider = ioc.serviceManager.get<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider);
        const doc = documentManager.textDocuments[0];
        const result = codeLensProvider.provideCodeLenses(doc, CancellationToken.None);
        // tslint:disable-next-line:no-any
        if ((result as any).length) {
            return result as CodeLens[];
        }
        return [];
    }

    runInteractiveTest(
        'Debug cell without breakpoint',
        async () => {
            await debugCell('default', '#%%\nprint("bar")');
        },
        createIOC
    );
    runInteractiveTest(
        'Check variables',
        async () => {
            ioc.setExperimentState(RunByLine.experiment, true);
            await debugCell('default', '#%%\nx = [4, 6]\nx = 5', undefined, undefined, false, () => {
                const targetResult = {
                    name: 'x',
                    value: '[4, 6]',
                    supportsDataExplorer: true,
                    type: 'list',
                    size: 0,
                    shape: '',
                    count: 2,
                    truncated: false
                };
                verifyVariables(ioc!.getDefaultWrapper()!, [targetResult]);
            });
        },
        createIOC
    );

    runInteractiveTest(
        'Debug temporary file',
        async () => {
            const code = '#%%\nprint("bar")';

            // Create a dummy document with just this code
            const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
            const fileName = 'Untitled-1';
            docManager.addDocument(code, fileName);
            const mockDoc = docManager.textDocuments[0] as MockDocument;
            mockDoc.forceUntitled();

            // Start the jupyter server
            const history = await getOrCreateInteractiveWindow(ioc);
            const expectedBreakLine = 2; // 2 because of the 'breakpoint()' that gets added

            // Debug this code. We should either hit the breakpoint or stop on entry
            const resultPromise = getInteractiveCellResults(ioc, ioc.getDefaultWrapper()!, async () => {
                const breakPromise = createDeferred<void>();
                disposables.push(jupyterDebuggerService!.onBreakpointHit(() => breakPromise.resolve()));
                const targetUri = Uri.file(fileName);
                const done = history.debugCode(code, targetUri.fsPath, 0, docManager.activeTextEditor);
                await waitForPromise(Promise.race([done, breakPromise.promise]), 60000);
                assert.ok(breakPromise.resolved, 'Breakpoint event did not fire');
                assert.ok(!lastErrorMessage, `Error occurred ${lastErrorMessage}`);
                const stackFrames = await jupyterDebuggerService!.getStack();
                assert.ok(stackFrames, 'Stack trace not computable');
                assert.ok(stackFrames.length >= 1, 'Not enough frames');
                assert.equal(stackFrames[0].line, expectedBreakLine, 'Stopped on wrong line number');
                assert.ok(
                    stackFrames[0].source!.path!.includes('baz.py'),
                    'Stopped on wrong file name. Name should have been saved'
                );
                // Verify break location
                await jupyterDebuggerService!.continue();
            });

            const cellResults = await resultPromise;
            assert.ok(cellResults, 'No cell results after finishing debugging');
            await history.dispose();
        },
        createIOC
    );

    runNativeTest(
        'Run by line',
        async () => {
            // Create an editor so something is listening to messages
            await createNewEditor(ioc);
            const webPanel = ioc.getWebPanel('notebook');
            const wrapper = webPanel.wrapper;

            // Add a cell into the UI and wait for it to render and submit it.
            await addCell(ioc, wrapper, 'a=1\na', true);

            // Step into this cell using the button
            let cell = getLastOutputCell(wrapper, 'NativeCell');
            let ImageButtons = cell.find(ImageButton);
            assert.equal(ImageButtons.length, 7, 'Cell buttons not found');
            const runByLineButton = ImageButtons.at(3);
            // tslint:disable-next-line: no-any
            assert.equal((runByLineButton.instance().props as any).tooltip, 'Run by line');

            const promise = webPanel.waitForMessage(InteractiveWindowMessages.ShowingIp);
            runByLineButton.simulate('click');
            await promise;

            // We should be in the break state. See if buttons indicate that or not
            cell = getLastOutputCell(wrapper, 'NativeCell');
            ImageButtons = cell.find(ImageButton);
            assert.equal(ImageButtons.length, 5, 'Cell buttons wrong number');
        },
        () => {
            ioc.setExperimentState(RunByLine.experiment, true);
            return createIOC();
        }
    );
    runNativeTest(
        'Run by line state check',
        async () => {
            // Create an editor so something is listening to messages
            await createNewEditor(ioc);
            const wrapper = ioc.getWebPanel('notebook').wrapper;

            // Add a cell into the UI and wait for it to render and submit it.
            await addCell(ioc, wrapper, 'a=1\na=2\na=3', true);

            // Step into this cell using the button
            let cell = getLastOutputCell(wrapper, 'NativeCell');
            let ImageButtons = cell.find(ImageButton);
            assert.equal(ImageButtons.length, 7, 'Cell buttons not found');
            const runByLineButton = ImageButtons.at(3);
            // tslint:disable-next-line: no-any
            assert.equal((runByLineButton.instance().props as any).tooltip, 'Run by line');

            const promise = ioc.getWebPanel('notebook').waitForMessage(InteractiveWindowMessages.DebugStateChange, {
                withPayload: (p) => {
                    return p.oldState === DebugState.Design && p.newState === DebugState.Run;
                }
            });
            runByLineButton.simulate('click');
            await promise;

            // We should be running, is the run by line button disabled?
            cell = getLastOutputCell(wrapper, 'NativeCell');
            ImageButtons = cell.find(ImageButton);
            // tslint:disable-next-line: no-any
            let runByLineButtonProps = ImageButtons.at(3).instance().props as any;
            expect(runByLineButtonProps.disabled).to.equal(true, 'Run by line button not disabled when running');

            // Now wait for break mode
            const breakPromise = ioc
                .getWebPanel('notebook')
                .waitForMessage(InteractiveWindowMessages.DebugStateChange, {
                    withPayload: (p) => {
                        return p.oldState === DebugState.Run && p.newState === DebugState.Break;
                    }
                });
            await breakPromise;

            cell = getLastOutputCell(wrapper, 'NativeCell');
            ImageButtons = cell.find(ImageButton);
            // tslint:disable-next-line: no-any
            runByLineButtonProps = ImageButtons.at(3).instance().props as any;
            expect(runByLineButtonProps.disabled).to.equal(false, 'Run by line button not active in break mode');
        },
        () => {
            ioc.setExperimentState(RunByLine.experiment, true);
            return createIOC();
        }
    );
});
