// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert } from 'chai';
import { instance, mock, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { ApplicationShell } from '../../client/common/application/applicationShell';
import { IApplicationShell } from '../../client/common/application/types';
import { IMultiStepInput, InputStep, MultiStepInput } from '../../client/common/utils/multiStepInput';
import { JupyterUriQuickPickerRegistration } from '../../client/datascience/jupyterUriQuickPickerRegistration';
import { IJupyterServerUri, IJupyterUriQuickPicker } from '../../client/datascience/types';
import { MockExtensions } from './mockExtensions';

class MockPicker implements IJupyterUriQuickPicker {
    public id: string = '1';
    public getQuickPickEntryItems(): vscode.QuickPickItem[] {
        return [{ label: 'Foo' }];
    }
    public async handleNextSteps(
        _item: vscode.QuickPickItem,
        completion: (uriHandle: string | undefined) => void,
        _input: IMultiStepInput<{}>,
        _state: {}
    ): Promise<void | InputStep<{}>> {
        completion('1');
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
    let registration: JupyterUriQuickPickerRegistration;
    let appShell: IApplicationShell;
    setup(() => {
        appShell = mock(ApplicationShell);
        const extensions = mock(MockExtensions);
        const extension = TypeMoq.Mock.ofType<vscode.Extension<any>>();
        const packageJson = TypeMoq.Mock.ofType<any>();
        const contributes = TypeMoq.Mock.ofType<any>();
        extension.setup((e) => e.packageJSON).returns(() => packageJson.object);
        packageJson.setup((p) => p.contributes).returns(() => contributes.object);
        contributes.setup((p) => p.pythonRemoteServerProvider).returns(() => [{ d: '' }]);
        when(extensions.all).thenReturn([extension.object]);
        extension
            .setup((e) => e.activate())
            .returns(() => {
                registration.registerPicker(new MockPicker());
                return Promise.resolve();
            });
        extension.setup((e) => e.isActive).returns(() => false);
        registration = new JupyterUriQuickPickerRegistration(instance(extensions));
    });

    test('Simple', async () => {
        const pickers = await registration.getPickers();
        assert.equal(pickers.length, 1, 'Default picker should be there');
        const quickPick = pickers[0].getQuickPickEntryItems();
        assert.equal(quickPick.length, 1, 'No quick pick items added');
        let handle: string | undefined;
        await pickers[0].handleNextSteps(quickPick[0], (h) => (handle = h), new MultiStepInput(instance(appShell)), {});
        assert.ok(handle, 'Handle not set');
        const uri = await registration.getJupyterServerUri('1', handle!);
        // tslint:disable-next-line: no-http-string
        assert.equal(uri.baseUrl, 'http://foobar:3000', 'Base URL not found');
    });
    test('Error', async () => {
        const pickers = await registration.getPickers();
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
    test('No registration', async () => {
        try {
            await registration.getJupyterServerUri('1', 'foobar');
            // tslint:disable-next-line: no-http-string
            assert.fail('Should not get here');
        } catch {
            // This means test passed.
        }
    });
});
