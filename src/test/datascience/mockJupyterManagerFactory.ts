// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import {
    IJupyterConnection,
    IJupyterSessionManager,
    IJupyterSessionManagerFactory
} from '../../client/datascience/types';
import { IServiceManager } from '../../client/ioc/types';
import { MockJupyterManager } from './mockJupyterManager';

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length

// This class is used to mock talking to jupyter. It mocks
// the process services, the interpreter services, the python services, and the jupyter session
export class MockJupyterManagerFactory implements IJupyterSessionManagerFactory {
    private mockJupyterManager: MockJupyterManager;

    constructor(serviceManager: IServiceManager) {
        serviceManager.addSingletonInstance<IJupyterSessionManagerFactory>(IJupyterSessionManagerFactory, this);
        this.mockJupyterManager = new MockJupyterManager(serviceManager);
    }

    public create(_connInfo: IJupyterConnection, _failOnPassword?: boolean): Promise<IJupyterSessionManager> {
        return Promise.resolve(this.mockJupyterManager);
    }

    public getManager(): MockJupyterManager {
        return this.mockJupyterManager;
    }

    public get onRestartSessionCreated() {
        return this.mockJupyterManager.onRestartSessionCreated;
    }

    public get onRestartSessionUsed() {
        return this.mockJupyterManager.onRestartSessionUsed;
    }
}
