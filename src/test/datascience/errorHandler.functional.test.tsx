// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { IDocumentManager } from '../../client/common/application/types';
import { JupyterInterpreterSubCommandExecutionService } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterSubCommandExecutionService';
import { JupyterInstallError } from '../../client/datascience/jupyter/jupyterInstallError';
import { ICodeWatcher, IInteractiveWindowProvider, IJupyterExecution } from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { MockDocumentManager } from './mockDocumentManager';

suite('DataScience Error Handler Functional Tests', () => {
    let ioc: DataScienceIocContainer;
    let stubbedInstallMissingDependencies: sinon.SinonStub<[(JupyterInstallError | undefined)?], Promise<void>>;
    setup(async () => {
        stubbedInstallMissingDependencies = sinon.stub(
            JupyterInterpreterSubCommandExecutionService.prototype,
            'installMissingDependencies'
        );
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        ioc = modifyContainer();
        return ioc.activate();
    });

    teardown(async () => {
        sinon.restore();
        await ioc.dispose();
    });

    function modifyContainer(): DataScienceIocContainer {
        const jupyterExecution = TypeMoq.Mock.ofType<IJupyterExecution>();

        jupyterExecution.setup((jup) => jup.getUsableJupyterPython()).returns(() => Promise.resolve(undefined));
        ioc.serviceManager.rebindInstance<IJupyterExecution>(IJupyterExecution, jupyterExecution.object);

        ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
        ioc.get<IJupyterExecution>(IJupyterExecution);
        stubbedInstallMissingDependencies.resolves();
        return ioc;
    }

    test('Jupyter not installed', async () => {
        ioc.addDocument('#%%\ntesting', 'test.py');

        const cw = ioc.serviceManager.get<ICodeWatcher>(ICodeWatcher);
        const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;

        cw.setDocument(docManager.textDocuments[0]);
        await cw.runAllCells();

        assert.isOk(stubbedInstallMissingDependencies.callCount, 'installMissingDependencies not invoked');
        await ioc.dispose();
    });
});
