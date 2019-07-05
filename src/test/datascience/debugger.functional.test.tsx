// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { mount } from 'enzyme';
import * as React from 'react';
import * as TypeMoq from 'typemoq';
import { Disposable, Position, Range, Uri } from 'vscode';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import * as vsls from 'vsls/vscode';

import { IApplicationShell, IDocumentManager } from '../../client/common/application/types';
import {
    InteractiveWindowMessageListener
} from '../../client/datascience/interactive-window/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-window/interactiveWindowTypes';
import { IInteractiveWindow, IInteractiveWindowProvider, IJupyterExecution } from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
import { createDebugAdapter } from '../debugger/utils';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { MockDocumentManager } from './mockDocumentManager';

//tslint:disable:trailing-comma no-any no-multiline-string

// tslint:disable-next-line:max-func-body-length no-any
suite('DataScience Debugger tests', () => {
    const disposables: Disposable[] = [];
    let ioc: DataScienceIocContainer;
    let debugAdapter: DebugClient;
    let lastErrorMessage : string | undefined;

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
        debugAdapter = await createDebugAdapter();
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
        lastErrorMessage = undefined;
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
        const listener = ((result as any).messageListener) as InteractiveWindowMessageListener;
        listener.onMessage(InteractiveWindowMessages.Started, {});

        return result;
    }

    async function debugCell(code: string, breakpoint?: Range) : Promise<void> {
        // Create a dummy document with just this code
        const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
        docManager.addDocument(code, 'foo.py');

        // Start the jupyter server
        const history = await getOrCreateInteractiveWindow();

        // Add a breakpoint if necessary
        if (breakpoint) {
            await debugAdapter.setBreakpointsRequest({
                lines: [breakpoint.start.line],
                breakpoints: [{ line: breakpoint.start.line, column: breakpoint.start.character }],
                source: { path: 'foo.py' }
            });
        }

        // Debug this code. We should either hit the breakpoint or stop on entry
        const done = history.debugCode(code, 'foo.py', 0, docManager.activeTextEditor);
        const result = await Promise.race([done, debugAdapter.waitForEvent('breakpoint')]);
        assert.ok(result, 'Debug event did not fire');
        assert.ok(!lastErrorMessage, `Error occurred ${lastErrorMessage}`);
        await done;
    }

    test('Debug cell with breakpoint', async () => {
        await debugCell('#%%\nprint("bar")');
    });

    test('Debug cell without breakpoint', async () => {
        await debugCell('#%%\nprint("bar")\nprint("baz")', new Range(new Position(2, 0), new Position(2, 0)));
    });

});
