// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';

import { QuickPickItem } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { DataScience } from '../../../client/common/utils/localize';
import { noop } from '../../../client/common/utils/misc';
import { MultiStepInputFactory } from '../../../client/common/utils/multiStepInput';
import { addToUriList } from '../../../client/datascience/common';
import { Settings } from '../../../client/datascience/constants';
import { JupyterServerSelector } from '../../../client/datascience/jupyter/serverSelector';
import { MockMemento } from '../../mocks/mementos';
import { MockInputBox } from '../mockInputBox';
import { MockQuickPick } from '../mockQuickPick';

// tslint:disable: max-func-body-length
suite('Data Science - Jupyter Server URI Selector', () => {
    let quickPick: MockQuickPick | undefined;

    function createDataScienceObject(quickPickSelection: string, inputSelection: string, updateCallback: (val: string) => void, mockStorage?: MockMemento): JupyterServerSelector {
        const configService = mock(ConfigurationService);
        const applicationShell = mock(ApplicationShell);
        const storage = mockStorage ? mockStorage : new MockMemento();
        quickPick = new MockQuickPick(quickPickSelection);
        const input = new MockInputBox(inputSelection);
        when(applicationShell.createQuickPick()).thenReturn(quickPick!);
        when(applicationShell.createInputBox()).thenReturn(input);
        const multiStepFactory = new MultiStepInputFactory(instance(applicationShell));
        when(configService.updateSetting('dataScience.jupyterServerURI', anything(), anything(), anything())).thenCall((_a1, a2, _a3, _a4) => {
            updateCallback(a2);
            return Promise.resolve();
        });

        return new JupyterServerSelector(storage, multiStepFactory, instance(configService));
    }

    test('Local pick server uri', async () => {
        let value = '';
        const ds = createDataScienceObject('$(zap) Default', '', v => (value = v));
        await ds.selectJupyterURI();
        assert.equal(value, Settings.JupyterServerLocalLaunch, 'Default should pick local launch');

        // Try a second time.
        await ds.selectJupyterURI();
        assert.equal(value, Settings.JupyterServerLocalLaunch, 'Default should pick local launch');

        // Verify active items
        assert.equal(quickPick?.items.length, 2, 'Wrong number of items in the quick pick');
    });

    test('Quick pick MRU tests', async () => {
        const mockStorage = new MockMemento();
        const ds = createDataScienceObject(
            '$(zap) Default',
            '',
            () => {
                noop();
            },
            mockStorage
        );

        await ds.selectJupyterURI();
        // Verify initial default items
        assert.equal(quickPick?.items.length, 2, 'Wrong number of items in the quick pick');

        // Add in a new server
        const serverA1 = { uri: 'ServerA', time: 1, date: new Date(1) };
        addToUriList(mockStorage, serverA1.uri, serverA1.time);

        await ds.selectJupyterURI();
        assert.equal(quickPick?.items.length, 3, 'Wrong number of items in the quick pick');
        quickPickCheck(quickPick?.items[2], serverA1);

        // Add in a second server, the newer server should be higher in the list due to newer time
        const serverB1 = { uri: 'ServerB', time: 2, date: new Date(2) };
        addToUriList(mockStorage, serverB1.uri, serverB1.time);
        await ds.selectJupyterURI();
        assert.equal(quickPick?.items.length, 4, 'Wrong number of items in the quick pick');
        quickPickCheck(quickPick?.items[2], serverB1);
        quickPickCheck(quickPick?.items[3], serverA1);

        // Reconnect to server A with a new time, it should now be higher in the list
        const serverA3 = { uri: 'ServerA', time: 3, date: new Date(3) };
        addToUriList(mockStorage, serverA3.uri, serverA3.time);
        await ds.selectJupyterURI();
        assert.equal(quickPick?.items.length, 4, 'Wrong number of items in the quick pick');
        quickPickCheck(quickPick?.items[3], serverB1);
        quickPickCheck(quickPick?.items[2], serverA1);

        // Verify that we stick to our settings limit
        for (let i = 0; i < Settings.JupyterServerUriListMax + 10; i = i + 1) {
            addToUriList(mockStorage, i.toString(), i);
        }

        await ds.selectJupyterURI();
        // Need a plus 2 here for the two default items
        assert.equal(quickPick?.items.length, Settings.JupyterServerUriListMax + 2, 'Wrong number of items in the quick pick');
    });

    function quickPickCheck(item: QuickPickItem | undefined, expected: { uri: string; time: Number; date: Date }) {
        assert.isOk(item, 'Quick pick item not defined');
        if (item) {
            assert.equal(item.label, expected.uri, 'Wrong URI value in quick pick');
            assert.equal(item.detail, DataScience.jupyterSelectURIMRUDetail().format(expected.date.toLocaleString()), 'Wrong detail value in quick pick');
        }
    }

    test('Remote server uri', async () => {
        let value = '';
        const ds = createDataScienceObject('$(server) Existing', 'http://localhost:1111', v => (value = v));
        await ds.selectJupyterURI();
        assert.equal(value, 'http://localhost:1111', 'Already running should end up with the user inputed value');
    });

    test('Invalid server uri', async () => {
        let value = '';
        const ds = createDataScienceObject('$(server) Existing', 'httx://localhost:1111', v => (value = v));
        await ds.selectJupyterURI();
        assert.notEqual(value, 'httx://localhost:1111', 'Already running should validate');
        assert.equal(value, '', 'Validation failed');
    });
});
