// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as TypeMoq from 'typemoq';
import * as vsls from 'vsls/vscode';

import { IDocumentManager } from '../../client/common/application/types';
import { IInstallationChannelManager, IModuleInstaller } from '../../client/common/installer/types';
import { ICodeWatcher, IInteractiveWindowProvider, IJupyterExecution } from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { MockDocumentManager } from './mockDocumentManager';
import { mountConnectedMainPanel } from './testHelpers';

suite('DataScience Error Handler Functional Tests', () => {
    let ioc: DataScienceIocContainer;
    let channels: TypeMoq.IMock<IInstallationChannelManager>;

    setup(() => {
        ioc = createContainer();
    });

    teardown(async () => {
        await ioc.dispose();
    });

    function createContainer(): DataScienceIocContainer {
        const result = new DataScienceIocContainer();
        result.registerDataScienceTypes();

        const jupyterExecution = TypeMoq.Mock.ofType<IJupyterExecution>();
        channels = TypeMoq.Mock.ofType<IInstallationChannelManager>();
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

        jupyterExecution.setup(jup => jup.getUsableJupyterPython()).returns(() => Promise.resolve(undefined));
        channels
            .setup(ch => ch.getInstallationChannels())
            .returns(() => Promise.resolve(installers))
            .verifiable(TypeMoq.Times.once());

        result.serviceManager.rebindInstance<IJupyterExecution>(IJupyterExecution, jupyterExecution.object);
        result.serviceManager.rebindInstance<IInstallationChannelManager>(IInstallationChannelManager, channels.object);

        result.createWebView(() => mountConnectedMainPanel('interactive'), vsls.Role.None);

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
        channels.verifyAll();
        await ioc.dispose();
    });
});
