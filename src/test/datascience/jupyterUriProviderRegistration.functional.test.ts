// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';

import { Event, EventEmitter, Extension, ExtensionKind, QuickPickItem, Uri } from 'vscode';
import { IExtensions } from '../../client/common/types';
import { sleep } from '../../client/common/utils/async';
import { Identifiers } from '../../client/datascience/constants';
import {
    IJupyterExecution,
    IJupyterServerUri,
    IJupyterUriProvider,
    IJupyterUriProviderRegistration
} from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';

const TestUriProviderId = 'TestUriProvider_Id';
const TestUriHandle = 'TestUriHandle';

class TestUriProvider implements IJupyterUriProvider {
    public id: string = TestUriProviderId;
    public currentBearer = 1;
    public getQuickPickEntryItems(): QuickPickItem[] {
        throw new Error('Method not implemented.');
    }
    public handleQuickPick(_item: QuickPickItem, _backEnabled: boolean): Promise<string | undefined> {
        throw new Error('Method not implemented.');
    }
    public async getServerUri(handle: string): Promise<IJupyterServerUri> {
        if (handle === TestUriHandle) {
            setTimeout(() => (this.currentBearer += 1), 300);
            return {
                // tslint:disable-next-line: no-http-string
                baseUrl: 'http://foobar:3000',
                displayName: 'test',
                token: '',
                authorizationHeader: { Bearer: this.currentBearer.toString() },
                expiration: new Date(Date.now() + 300) // Expire after 300 milliseconds
            };
        }

        throw new Error('Invalid server uri handle');
    }
}

// tslint:disable: no-any
class TestUriProviderExtension implements Extension<any> {
    public id: string = '1';
    public extensionUri: Uri = Uri.parse('foo');
    public extensionPath: string = 'foo';
    public isActive: boolean = false;
    public packageJSON: any = {
        contributes: {
            pythonRemoteServerProvider: []
        }
    };
    public extensionKind: ExtensionKind = ExtensionKind.Workspace;
    public exports: any = {};
    constructor(private ioc: DataScienceIocContainer) {}
    public async activate() {
        this.ioc
            .get<IJupyterUriProviderRegistration>(IJupyterUriProviderRegistration)
            .registerProvider(new TestUriProvider());
        this.isActive = true;
        return {};
    }
}

class UriMockExtensions implements IExtensions {
    public all: Extension<any>[] = [];
    private changeEvent = new EventEmitter<void>();
    constructor(ioc: DataScienceIocContainer) {
        this.all.push(new TestUriProviderExtension(ioc));
    }
    public getExtension<T>(_extensionId: string): Extension<T> | undefined {
        return undefined;
    }

    public get onDidChange(): Event<void> {
        return this.changeEvent.event;
    }
}

// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
suite(`DataScience JupyterServerUriProvider tests`, () => {
    let ioc: DataScienceIocContainer;

    setup(async () => {
        ioc = new DataScienceIocContainer();
        // Force to always be a mock run. Real will try to connect to the dummy URI
        ioc.shouldMockJupyter = true;
        ioc.registerDataScienceTypes(false);
        ioc.serviceManager.rebindInstance<IExtensions>(IExtensions, new UriMockExtensions(ioc));
        return ioc.activate();
    });

    teardown(async () => {
        await ioc.dispose();
    });

    test('Expiration', async () => {
        // Set the URI to id value.
        const uri = `${Identifiers.REMOTE_URI}?${Identifiers.REMOTE_URI_ID_PARAM}=${TestUriProviderId}&${Identifiers.REMOTE_URI_HANDLE_PARAM}=${TestUriHandle}`;
        ioc.forceDataScienceSettingsChanged({
            jupyterServerURI: uri
        });

        // Start a notebook server (should not actually start anything as it's remote)
        const jupyterExecution = ioc.get<IJupyterExecution>(IJupyterExecution);
        const server = await jupyterExecution.connectToNotebookServer({
            uri,
            purpose: 'history',
            allowUI: () => false
        });

        // Verify URI is our expected one
        // tslint:disable-next-line: no-http-string
        assert.equal(server?.getConnectionInfo()?.baseUrl, `http://foobar:3000`, 'Base URI is invalid');
        let authHeader = server?.getConnectionInfo()?.getAuthHeader?.call(undefined);
        assert.deepEqual(authHeader, { Bearer: '1' }, 'Bearer token invalid');

        // Wait a bit
        await sleep(500);

        authHeader = server?.getConnectionInfo()?.getAuthHeader?.call(undefined);

        // Auth header should have updated
        assert.notEqual(authHeader.Bearer, '1', 'Bearer token did not update');
    });
});
