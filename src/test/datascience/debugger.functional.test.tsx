// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { mount } from 'enzyme';
import * as React from 'react';
import * as TypeMoq from 'typemoq';
import { Disposable, Position, Range, Uri } from 'vscode';
import * as vsls from 'vsls/vscode';

import { IApplicationShell, IDebugService, IDocumentManager } from '../../client/common/application/types';
import { createDeferred, waitForPromise } from '../../client/common/utils/async';
import {
    InteractiveWindowMessageListener
} from '../../client/datascience/interactive-window/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-window/interactiveWindowTypes';
import { IInteractiveWindow, IInteractiveWindowProvider, IJupyterExecution } from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
//import { asyncDump } from '../common/asyncDump';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { getCellResults } from './interactiveWindowTestHelpers';
import { MockDebuggerService } from './mockDebugService';
import { MockDocumentManager } from './mockDocumentManager';

// tslint:disable-next-line:max-func-body-length no-any
suite('DataScience Debugger tests', () => {
    const disposables: Disposable[] = [];
    let ioc: DataScienceIocContainer;
    let lastErrorMessage : string | undefined;
    let mockDebuggerService : MockDebuggerService | undefined;

    suiteSetup(function () {
        // Debugger tests require jupyter to run. Othewrise can't not really testing them
        const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;
        if (!isRollingBuild) {
            // tslint:disable-next-line:no-console
            console.log('Skipping Debugger tests. Requires python environment');
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });

    setup(async () => {
        ioc = createContainer();
        mockDebuggerService = ioc.serviceManager.get<IDebugService>(IDebugService) as MockDebuggerService;
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
        if (mockDebuggerService) {
            mockDebuggerService.dispose();
        }
        await ioc.dispose();
        lastErrorMessage = undefined;
    });

    suiteTeardown(() => {
//        asyncDump();
    });

    function createContainer(): DataScienceIocContainer {
        const result = new DataScienceIocContainer();
        result.registerDataScienceTypes();

        // Rebind the appshell so we can change what happens on an error
        const dummyDisposable = {
            dispose: () => { return; }
        };
        const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        appShell.setup(a => a.showErrorMessage(TypeMoq.It.isAnyString())).returns((e) => lastErrorMessage = e);
        appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_a1: string, a2: string, _a3: string) => Promise.resolve(a2));
        appShell.setup(a => a.showSaveDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(Uri.file('test.ipynb')));
        appShell.setup(a => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);

        result.serviceManager.rebindInstance<IApplicationShell>(IApplicationShell, appShell.object);

        // Setup our webview panel
        result.createWebView(() => mount(<MainPanel baseTheme='vscode-light' codeTheme='light_vs' testMode={true} skipDefault={true} />), vsls.Role.None);

        // Make sure the history provider and execution factory in the container is created (the extension does this on startup in the extension)
        // This is necessary to get the appropriate live share services up and running.
        result.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
        result.get<IJupyterExecution>(IJupyterExecution);
        return result;
    }

    async function getOrCreateInteractiveWindow(): Promise<IInteractiveWindow> {
        const interactiveWindowProvider = ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
        const result = await interactiveWindowProvider.getOrCreateActive();

        // During testing the MainPanel sends the init message before our interactive window is created.
        // Pretend like it's happening now
        // tslint:disable-next-line: no-any
        const listener = ((result as any).messageListener) as InteractiveWindowMessageListener;
        listener.onMessage(InteractiveWindowMessages.Started, {});

        return result;
    }

    async function debugCell(code: string, _breakpoint?: Range) : Promise<void> {
        // Create a dummy document with just this code
        const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
        docManager.addDocument(code, 'foo.py');

        // Start the jupyter server
        const history = await getOrCreateInteractiveWindow();

        // Debug this code. We should either hit the breakpoint or stop on entry
        const results = await getCellResults(ioc.wrapper!, 5, async () => {
            const breakPromise = createDeferred<void>();
            disposables.push(mockDebuggerService!.onBreakpointHit(() => breakPromise.resolve()));
            const done = history.debugCode(code, 'foo.py', 0, docManager.activeTextEditor);
            await waitForPromise(Promise.race([done, breakPromise.promise]), 60000);
            assert.ok(breakPromise.resolved, 'Breakpoint event did not fire');
            assert.ok(!lastErrorMessage, `Error occurred ${lastErrorMessage}`);
            await mockDebuggerService!.continue();
        });
        assert.ok(results, 'No cell results after finishing debugging');
    }

    test('Debug cell without breakpoint', async () => {
        await debugCell('#%%\nprint("bar")');
    });

    test('Debug cell with breakpoint', async () => {
        await debugCell('#%%\nprint("bar")\nprint("baz")', new Range(new Position(2, 0), new Position(2, 0)));
    });

});
