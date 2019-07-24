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
            const installers = await this.channels.getInstallationChannels();
            if (installers) {
                if (typeof Array.prototype.find !== 'function') {
                    Array.prototype.find = function (iterator: any) {
                        const list = Object(this);
                        const length = list.length >>> 0;
                        const thisArg = arguments[1];
                        let value;

                        for (let i = 0; i < length; i += 1) {
                            value = list[i];
                            if (iterator.call(thisArg, value, i, list)) {
                                return value;
                            }
                        }
                        return undefined;
                    };
                }
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

    test('Default error', async () => {
        const err = new Error(message);
        const result = await dataScienceErrorHandler.handleError(err);
        expect(result).to.be.equal(message);
    });
    test('Jupyter Self Certificates Error', async () => {
        const err = new JupyterSelfCertsError(message);
        const result = await dataScienceErrorHandler.handleError(err);
        expect(result).to.be.equal('noop');
    });
    test('Jupyter Install Error', async () => {
        const err = new JupyterInstallError(message, 'test.com');
        const result = await dataScienceErrorHandler.handleError(err);
        expect(result).to.be.equal('installing');
    });
});
