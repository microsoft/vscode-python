// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';
import { Uri } from 'vscode';

import { CodeLens } from 'vscode';
import { ICommandManager } from '../../client/common/application/types';
import { Resource } from '../../client/common/types';
import { CodeWatcher } from '../../client/datascience/editor-integration/codewatcher';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { ICodeWatcher, IDataScienceCodeLensProvider, IInteractiveWindow, IInteractiveWindowProvider, IJupyterExecution } from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { IMountedWebView } from './mountedWebView';
import { addMockData } from './testHelpers';
import { TestInteractiveWindowProvider } from './testInteractiveWindowProvider';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';

export async function getInteractiveCellResults(
    ioc: DataScienceIocContainer,
    updater: () => Promise<void>,
    window?: IInteractiveWindow | undefined
): Promise<ReactWrapper> {
    const mountedWebView = ioc.get<TestInteractiveWindowProvider>(IInteractiveWindowProvider).getMountedWebView(window);

    // Get a render promise with the expected number of renders
    const renderPromise = updater
        ? updater()
        : mountedWebView.waitForMessage(InteractiveWindowMessages.ExecutionRendered);

    // Call our function to update the react control
    await updater();

    // Wait for all of the renders to go through
    await renderPromise;

    // Update wrapper so that it gets the latest values.
    mountedWebView.wrapper.update();

    // Return the result
    return mountedWebView.wrapper.find('InteractiveCell');
}

export async function getOrCreateInteractiveWindow(
    ioc: DataScienceIocContainer,
    owner?: Resource
): Promise<{ window: IInteractiveWindow; mount: IMountedWebView }> {
    const interactiveWindowProvider = ioc.get<TestInteractiveWindowProvider>(IInteractiveWindowProvider);
    const window = (await interactiveWindowProvider.getOrCreate(owner)) as InteractiveWindow;
    const mount = interactiveWindowProvider.getMountedWebView(window);
    return { window, mount };
}

export function createCodeWatcher(
    docText: string,
    docName: string,
    ioc: DataScienceIocContainer
): ICodeWatcher | undefined {
    const doc = ioc.addDocument(docText, docName);
    const codeLensProvider = ioc.get<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider);
    return codeLensProvider.getCodeWatcher(doc);
}

export async function runCodeLens(codeLens: CodeLens | undefined, ioc: DataScienceIocContainer): Promise<void> {
    const commandManager = ioc.get<ICommandManager>(ICommandManager);
    if (codeLens && codeLens.command) {
        // tslint:disable-next-line: no-any
        await commandManager.executeCommand(codeLens.command.command as any, codeLens.command.arguments);
    }
}

export function closeInteractiveWindow(ioc: DataScienceIocContainer, window: IInteractiveWindow) {
    const promise = window.dispose();
    ioc.get<TestInteractiveWindowProvider>(IInteractiveWindowProvider).getMountedWebView(window).dispose();
    return promise;
}

export function runTest(
    name: string,
    // tslint:disable-next-line:no-any
    testFunc: (context: Mocha.Context) => Promise<void>,
    getIOC: () => DataScienceIocContainer
) {
    test(name, async function () {
        const ioc = getIOC();
        const jupyterExecution = ioc.get<IJupyterExecution>(IJupyterExecution);
        if (await jupyterExecution.isNotebookSupported()) {
            addMockData(ioc, 'a=1\na', 1);
            // tslint:disable-next-line: no-invalid-this
            await testFunc(this);
        } else {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });
}

export async function addCode(
    ioc: DataScienceIocContainer,
    code: string,
    expectError: boolean = false,
    uri: Uri = Uri.file('foo.py')
    // tslint:disable-next-line: no-any
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    const { window, mount } = await getOrCreateInteractiveWindow(ioc);
    return getInteractiveCellResults(ioc, mount.wrapper, async () => {
        const success = await window.addCode(code, uri, 2);
        if (expectError) {
            assert.equal(success, false, `${code} did not produce an error`);
        }
    });
}
