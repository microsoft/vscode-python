// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as typemoq from 'typemoq';
import { IApplicationShell } from '../../client/common/application/types';
import { IInstallationChannelManager, IModuleInstaller } from '../../client/common/installer/types';
import { ILogger } from '../../client/common/types';
import * as localize from '../../client/common/utils/localize';
import { DataScienceErrorHandler } from '../../client/datascience/errorHandler/errorHandler';
import { JupyterInstallError } from '../../client/datascience/jupyter/jupyterInstallError';
import { JupyterSelfCertsError } from '../../client/datascience/jupyter/jupyterSelfCertsError';

suite('DataScience Error Handler Unit Tests', () => {
    let applicationShell: typemoq.IMock<IApplicationShell>;
    let logger: typemoq.IMock<ILogger>;
    let channels: typemoq.IMock<IInstallationChannelManager>;
    let dataScienceErrorHandler: DataScienceErrorHandler;

    setup(() => {
        applicationShell = typemoq.Mock.ofType<IApplicationShell>();
        logger = typemoq.Mock.ofType<ILogger>();
        channels = typemoq.Mock.ofType<IInstallationChannelManager>();

        dataScienceErrorHandler = new DataScienceErrorHandler(applicationShell.object, logger.object, channels.object);
    });
    const message = 'Test error message.';

    test('Default error', async () => {
        applicationShell
            .setup(app => app.showErrorMessage(typemoq.It.isAny()))
            .returns(() => Promise.resolve(message))
            .verifiable(typemoq.Times.once());

        logger.setup(log => log.logError(typemoq.It.isAny())).verifiable(typemoq.Times.once());

        const err = new Error(message);
        await dataScienceErrorHandler.handleError(err);

        applicationShell.verifyAll();
        logger.verifyAll();
    });

    test('Jupyter Self Certificates Error', async () => {
        logger.setup(log => log.logError(typemoq.It.isAny())).verifiable(typemoq.Times.once());

        const err = new JupyterSelfCertsError(message);
        await dataScienceErrorHandler.handleError(err);

        logger.verifyAll();
    });

    test('Jupyter Install Error', async () => {
        applicationShell
            .setup(app =>
                app.showInformationMessage(
                    typemoq.It.isAny(),
                    typemoq.It.isValue(localize.DataScience.jupyterInstall()),
                    typemoq.It.isValue(localize.DataScience.notebookCheckForImportNo()),
                    typemoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(localize.DataScience.jupyterInstall()))
            .verifiable(typemoq.Times.once());

        logger.setup(log => log.logError(typemoq.It.isAny())).verifiable(typemoq.Times.once());

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
            .verifiable(typemoq.Times.once());

        const err = new JupyterInstallError(message, 'test.com');
        await dataScienceErrorHandler.handleError(err);

        applicationShell.verifyAll();
        logger.verifyAll();
        channels.verifyAll();
    });
});
