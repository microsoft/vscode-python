// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as vsls from 'vsls/vscode';
import { IDocumentManager } from '../../client/common/application/types';
import { IInstallationChannelManager, IModuleInstaller } from '../../client/common/installer/types';
import { JupyterInterpreterSubCommandExecutionService } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterSubCommandExecutionService';
import { JupyterInstallError } from '../../client/datascience/jupyter/jupyterInstallError';
import { ICodeWatcher, IInteractiveWindowProvider, IJupyterExecution } from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { MockDocumentManager } from './mockDocumentManager';
import { mountConnectedMainPanel } from './testHelpers';

suite('DataScience Error Handler Functional Tests', () => {
    let ioc: DataScienceIocContainer;
    let channels: TypeMoq.IMock<IInstallationChannelManager>;
    let stubbedInstallMissingDependencies: sinon.SinonStub<[(JupyterInstallError | undefined)?], Promise<void>>;
    setup(() => {
        stubbedInstallMissingDependencies = sinon.stub(
            JupyterInterpreterSubCommandExecutionService.prototype,
            'installMissingDependencies'
        );
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        ioc = modifyContainer();
    });

    teardown(async () => {
        sinon.restore();
        await ioc.dispose();
    });

    function modifyContainer(): DataScienceIocContainer {
        const jupyterExecution = TypeMoq.Mock.ofType<IJupyterExecution>();

        jupyterExecution.setup(jup => jup.getUsableJupyterPython()).returns(() => Promise.resolve(undefined));
        ioc.serviceManager.rebindInstance<IJupyterExecution>(IJupyterExecution, jupyterExecution.object);

        ioc.createWebView(() => mountConnectedMainPanel('interactive'), vsls.Role.None);

        ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
        ioc.get<IJupyterExecution>(IJupyterExecution);

        if (ioc.useCommandFinderForJupyterServer) {
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
            channels
                .setup(ch => ch.getInstallationChannels())
                .returns(() => Promise.resolve(installers))
                .verifiable(TypeMoq.Times.once());

            ioc.serviceManager.rebindInstance<IInstallationChannelManager>(
                IInstallationChannelManager,
                channels.object
            );
        } else {
            stubbedInstallMissingDependencies.resolves();
        }
        return ioc;
    }

    test('Jupyter not installed', async () => {
        ioc.addDocument('#%%\ntesting', 'test.py');

        const cw = ioc.serviceManager.get<ICodeWatcher>(ICodeWatcher);
        const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;

        cw.setDocument(docManager.textDocuments[0]);
        await cw.runAllCells();

        if (ioc.useCommandFinderForJupyterServer) {
            channels.verifyAll();
        } else {
            assert.isOk(stubbedInstallMissingDependencies.callCount, 'installMissingDependencies not invoked');
        }
        await ioc.dispose();
    });
});
