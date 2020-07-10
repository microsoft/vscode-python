// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';
import { Uri } from 'vscode';

import { Resource } from '../../client/common/types';
import { CodeWatcher } from '../../client/datascience/editor-integration/codewatcher';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { ICodeWatcher, IDataScienceCodeLensProvider, IInteractiveWindow, IInteractiveWindowProvider, IJupyterExecution } from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { addMockData, getCellResults, mountWebView, mountConnectedMainPanel } from './testHelpers';
import { CodeLens } from 'vscode';
import { ICommandManager } from '../../client/common/application/types';
import { IMountedWebView } from './mountedWebView';

export function getInteractiveCellResults(
    ioc: DataScienceIocContainer,
    // tslint:disable-next-line: no-any
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    updater: () => Promise<void>
    // tslint:disable-next-line: no-any
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    return getCellResults(ioc, 'default', wrapper, 'InteractiveCell', updater);
}

let singleMountedView: IMountedWebView;
export async function getOrCreateMountedInteractiveWindow(
    ioc: DataScienceIocContainer,
    id: string,
    owner?: Resource,
): Promise<{ window: InteractiveWindow; mount: IMountedWebView }> {
    const wrapper =
        ioc.getSettings().datascience.interactiveWindowMode === 'single' && singleMountedView
            ? singleMountedView
            : ioc.createWebView(() => mountConnectedMainPanel('interactive'), id)
    singleInteractiveWrapper = wrapper;
    const interactiveWindowProvider = ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
    const window = (await interactiveWindowProvider.getOrCreate(owner)) as InteractiveWindow;
    return { window, wrapper };
}

export async function getOrCreateInteractiveWindow(
    ioc: DataScienceIocContainer,
    owner?: Resource
): Promise<IInteractiveWindow> {
    const interactiveWindowProvider = ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
    return (await interactiveWindowProvider.getOrCreate(owner)) as InteractiveWindow;
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
    ioc.getWebPanel('default').dispose();
    return promise;
}

export function runMountedTest(
    name: string,
    // tslint:disable-next-line:no-any
    testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, context: Mocha.Context) => Promise<void>,
    getIOC: () => DataScienceIocContainer
) {
    test(name, async function () {
        const ioc = getIOC();
        const jupyterExecution = ioc.get<IJupyterExecution>(IJupyterExecution);
        if (await jupyterExecution.isNotebookSupported()) {
            addMockData(ioc, 'a=1\na', 1);
            const wrapper = mountWebView(ioc, 'interactive');
            // tslint:disable-next-line: no-invalid-this
            await testFunc(wrapper, this);
        } else {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });
}

export async function addCode(
    ioc: DataScienceIocContainer,
    // tslint:disable-next-line: no-any
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    code: string,
    expectError: boolean = false,
    uri: Uri = Uri.file('foo.py')
    // tslint:disable-next-line: no-any
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    // Adding code should cause 5 renders to happen.
    // 1) Input
    // 2) Status ready
    // 3) Execute_Input message
    // 4) Output message (if there's only one)
    // 5) Status finished
    return getInteractiveCellResults(ioc, wrapper, async () => {
        const history = await getOrCreateInteractiveWindow(ioc);
        const success = await history.addCode(code, uri, 2);
        if (expectError) {
            assert.equal(success, false, `${code} did not produce an error`);
        }
    });
}
