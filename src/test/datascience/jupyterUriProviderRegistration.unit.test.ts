// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { JupyterUriProviderRegistration } from '../../client/datascience/jupyterUriProviderRegistration';
import { IJupyterServerUri, IJupyterUriProvider, JupyterServerUriHandle } from '../../client/datascience/types';
import { MockExtensions } from './mockExtensions';

class MockProvider implements IJupyterUriProvider {
    public get id() {
        return this._id;
    }
    private result: string = '1';
    constructor(private readonly _id: string) {
        // Id should be readonly
    }
    public getQuickPickEntryItems(): vscode.QuickPickItem[] {
        return [{ label: 'Foo' }];
    }
    public async handleQuickPick(
        _item: vscode.QuickPickItem,
        back: boolean
    ): Promise<JupyterServerUriHandle | 'back' | undefined> {
        return back ? 'back' : this.result;
    }
    public async getServerUri(handle: string): Promise<IJupyterServerUri> {
        if (handle === '1') {
            return {
                // tslint:disable-next-line: no-http-string
                baseUrl: 'http://foobar:3000',
                token: '',
                authorizationHeader: { Bearer: '1' }
            };
        }

        throw new Error('Invalid server uri handle');
    }
}

// tslint:disable: max-func-body-length no-any
suite('DataScience URI Picker', () => {
    function createRegistration(providerIds: string[]) {
        let registration: JupyterUriProviderRegistration | undefined;
        const extensions = mock(MockExtensions);
        const extensionList: vscode.Extension<any>[] = [];
        const fileSystem = mock(FileSystem);
        when(fileSystem.fileExists(anything())).thenResolve(false);
        providerIds.forEach((id) => {
            const extension = TypeMoq.Mock.ofType<vscode.Extension<any>>();
            const packageJson = TypeMoq.Mock.ofType<any>();
            const contributes = TypeMoq.Mock.ofType<any>();
            extension.setup((e) => e.packageJSON).returns(() => packageJson.object);
            packageJson.setup((p) => p.contributes).returns(() => contributes.object);
            contributes.setup((p) => p.pythonRemoteServerProvider).returns(() => [{ d: '' }]);
            extension
                .setup((e) => e.activate())
                .returns(() => {
                    registration?.registerProvider(new MockProvider(id));
                    return Promise.resolve();
                });
            extension.setup((e) => e.isActive).returns(() => false);
            extensionList.push(extension.object);
        });
        when(extensions.all).thenReturn(extensionList);
        registration = new JupyterUriProviderRegistration(instance(extensions), instance(fileSystem));
        return registration;
    }

    test('Simple', async () => {
        const registration = createRegistration(['1']);
        const pickers = await registration.getProviders();
        assert.equal(pickers.length, 1, 'Default picker should be there');
        const quickPick = pickers[0].getQuickPickEntryItems();
        assert.equal(quickPick.length, 1, 'No quick pick items added');
        const handle = await pickers[0].handleQuickPick(quickPick[0], false);
        assert.ok(handle, 'Handle not set');
        const uri = await registration.getJupyterServerUri('1', handle!);
        // tslint:disable-next-line: no-http-string
        assert.equal(uri.baseUrl, 'http://foobar:3000', 'Base URL not found');
    });
    test('Back', async () => {
        const registration = createRegistration(['1']);
        const pickers = await registration.getProviders();
        assert.equal(pickers.length, 1, 'Default picker should be there');
        const quickPick = pickers[0].getQuickPickEntryItems();
        assert.equal(quickPick.length, 1, 'No quick pick items added');
        const handle = await pickers[0].handleQuickPick(quickPick[0], true);
        assert.equal(handle, 'back', 'Should be sending back');
    });
    test('Error', async () => {
        const registration = createRegistration(['1']);
        const pickers = await registration.getProviders();
        assert.equal(pickers.length, 1, 'Default picker should be there');
        const quickPick = pickers[0].getQuickPickEntryItems();
        assert.equal(quickPick.length, 1, 'No quick pick items added');
        try {
            await registration.getJupyterServerUri('1', 'foobar');
            // tslint:disable-next-line: no-http-string
            assert.fail('Should not get here');
        } catch {
            // This means test passed.
        }
    });
    test('No picker call', async () => {
        const registration = createRegistration(['1']);
        const uri = await registration.getJupyterServerUri('1', '1');
        // tslint:disable-next-line: no-http-string
        assert.equal(uri.baseUrl, 'http://foobar:3000', 'Base URL not found');
    });
    test('Two pickers', async () => {
        const registration = createRegistration(['1', '2']);
        let uri = await registration.getJupyterServerUri('1', '1');
        // tslint:disable-next-line: no-http-string
        assert.equal(uri.baseUrl, 'http://foobar:3000', 'Base URL not found');
        uri = await registration.getJupyterServerUri('2', '1');
        // tslint:disable-next-line: no-http-string
        assert.equal(uri.baseUrl, 'http://foobar:3000', 'Base URL not found');
    });
    test('Two pickers with same id', async () => {
        const registration = createRegistration(['1', '1']);
        try {
            await registration.getJupyterServerUri('1', '1');
            // tslint:disable-next-line: no-http-string
            assert.fail('Should have failed if calling with same picker');
        } catch {
            // This means it passed
        }
    });
});
