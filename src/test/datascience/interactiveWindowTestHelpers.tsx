// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';
import { CodeLens, Uri } from 'vscode';

import { ICommandManager, IDocumentManager } from '../../client/common/application/types';
import { Resource } from '../../client/common/types';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import {
    ICodeWatcher,
    IDataScienceCodeLensProvider,
    IInteractiveWindow,
    IInteractiveWindowProvider,
    IJupyterExecution
} from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { MockDocumentManager } from './mockDocumentManager';
import { IMountedWebView } from './mountedWebView';
import { addMockData, getCellResults } from './testHelpers';
import { TestInteractiveWindowProvider } from './testInteractiveWindowProvider';

export async function getInteractiveCellResults(
    ioc: DataScienceIocContainer,
    updater: () => Promise<void>,
    window?: IInteractiveWindow | undefined
): Promise<ReactWrapper> {
    const mountedWebView = ioc.get<TestInteractiveWindowProvider>(IInteractiveWindowProvider).getMountedWebView(window);
    return getCellResults(mountedWebView, 'InteractiveCell', updater);
}

export async function getOrCreateInteractiveWindow(
    ioc: DataScienceIocContainer,
    owner?: Resource
): Promise<{ window: IInteractiveWindow; mount: IMountedWebView }> {
    const interactiveWindowProvider = ioc.get<TestInteractiveWindowProvider>(IInteractiveWindowProvider);
    const window = (await interactiveWindowProvider.getOrCreate(owner)) as InteractiveWindow;
    const mount = interactiveWindowProvider.getMountedWebView(window);
    await window.show();
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

export async function runCodeLens(
    uri: Uri,
    codeLens: CodeLens | undefined,
    ioc: DataScienceIocContainer
): Promise<void> {
    const documentManager = ioc.get<MockDocumentManager>(IDocumentManager);
    await documentManager.showTextDocument(uri);
    const commandManager = ioc.get<ICommandManager>(ICommandManager);
    if (codeLens && codeLens.command) {
        // tslint:disable-next-line: no-any
        await commandManager.executeCommand(codeLens.command.command as any, ...codeLens.command.arguments);
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
    const { window } = await getOrCreateInteractiveWindow(ioc);
    return getInteractiveCellResults(ioc, async () => {
        const success = await window.addCode(code, uri, 2);
        if (expectError) {
            assert.equal(success, false, `${code} did not produce an error`);
        }
    });
}
