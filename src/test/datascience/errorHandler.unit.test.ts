// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import { mock } from 'ts-mockito';
import { InstallationChannelManager } from '../../client/common/installer/channelManager';
import { ProductNames } from '../../client/common/installer/productNames';
import { Product } from '../../client/common/types';
import { JupyterInstallError } from '../../client/datascience/jupyter/jupyterInstallError';
import { JupyterSelfCertsError } from '../../client/datascience/jupyter/jupyterSelfCertsError';
import { IDataScienceErrorHandler } from '../../client/datascience/types';

class MockErrorHandler implements IDataScienceErrorHandler {
    private channels = mock(InstallationChannelManager);

    public async handleError(err: Error): Promise<string> {
        if (err instanceof JupyterInstallError) {
            return this.channels.getInstallationChannels()
                .then(installers => {
                    if (installers) {
                        // If Conda is available, always pick it as the user must have a Conda Environment
                        const installer = installers.find(ins => ins.name === 'Conda');
                        const product = ProductNames.get(Product.jupyter);

                        if (installer && product) {
                            return 'installing';
                        } else if (installers[0] && product) {
                            return 'installing';
                        }
                    }
                    return 'error';
                });
        } else if (err instanceof JupyterSelfCertsError) {
            return 'noop';
        } else if (err.message) {
            return err.message;
        } else {
            return err.toString();
        }
    }
}

suite('DataScience Error Handler Unit Tests', () => {
    const dataScienceErrorHandler = new MockErrorHandler();
    const message = 'Test error message.';

    test('Default error', () => {
        const err = new Error(message);
        expect(dataScienceErrorHandler.handleError(err)).to.be.equal(message);
    });
    test('Jupyter Self Certificates Error', () => {
        const err = new JupyterSelfCertsError(message);
        expect(dataScienceErrorHandler.handleError(err)).to.be.equal('noop');
    });
    test('Jupyter Install Error', () => {
        const err = new JupyterInstallError(message, 'test.com');
        expect(dataScienceErrorHandler.handleError(err)).to.be.equal('installing');
    });
});
