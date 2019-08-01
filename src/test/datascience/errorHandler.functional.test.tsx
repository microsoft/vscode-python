// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { mount } from 'enzyme';
import * as React from 'react';
import * as TypeMoq from 'typemoq';
import * as vsls from 'vsls/vscode';
import { IDocumentManager } from '../../client/common/application/types';
import { IInstallationChannelManager, IModuleInstaller } from '../../client/common/installer/types';
import {
    ICodeWatcher,
    IInteractiveWindowProvider,
    IJupyterExecution
} from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { MockDocumentManager } from './mockDocumentManager';

suite('DataScience Error Handler Functional Tests', () => {
    const ioc = createContainer();

    function createContainer(): DataScienceIocContainer {
        const result = new DataScienceIocContainer();
        result.registerDataScienceTypes();

        const jupyterExecution = TypeMoq.Mock.ofType<IJupyterExecution>();
        const channels = TypeMoq.Mock.ofType<IInstallationChannelManager>();
        const installers: IModuleInstaller[] = [
            {
                name: 'Pip',
                displayName: 'Pip',
                priority: 0,
                isSupported: () => Promise.resolve(true),
                installModule: () => Promise.resolve()
            },
            {
                name: 'Conda',
                displayName: 'Conda',
                priority: 0,
                isSupported: () => Promise.resolve(true),
                installModule: () => Promise.resolve()
            }
        ];

        jupyterExecution.setup(jup => jup.getUsableJupyterPython())
            .returns(() => Promise.resolve(undefined));
        channels.setup(ch => ch.getInstallationChannels())
            .returns(() => Promise.resolve(installers))
            .verifiable(TypeMoq.Times.once());

        result.serviceManager.rebindInstance<IJupyterExecution>(IJupyterExecution, jupyterExecution.object);
        result.serviceManager.rebindInstance<IInstallationChannelManager>(IInstallationChannelManager, channels.object);

        result.createWebView(() => mount(<MainPanel baseTheme='vscode-light' codeTheme='light_vs' testMode={true} skipDefault={true} />), vsls.Role.None);

        result.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
        result.get<IJupyterExecution>(IJupyterExecution);
        return result;
    }

    test('Jupyter not installed', async () => {
        ioc.addDocument('#%%\ntesting', 'test.py');

        const cw = ioc.serviceManager.get<ICodeWatcher>(ICodeWatcher);
        const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;

        cw.setDocument(docManager.textDocuments[0]);
        await cw.runAllCells();
        await ioc.dispose();
    });
});
