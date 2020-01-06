// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import { workspace } from 'vscode';
import { IAsyncDisposableRegistry, IConfigurationService } from '../../../client/common/types';
import { getExtensionSettings } from '../../common';
import { initialize } from '../../initialize';
import { UnitTestIocContainer } from '../../testing/serviceRegistry';

// tslint:disable-next-line:max-func-body-length
suite('Configuration Service', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(initialize);
    setup(() => {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
    });
    teardown(() => ioc.dispose());

    test('Ensure same instance of settings return', () => {
        const workspaceUri = workspace.workspaceFolders![0].uri;
        const settings = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(workspaceUri);
        const instanceIsSame = settings === getExtensionSettings(workspaceUri);
        expect(instanceIsSame).to.be.equal(true, 'Incorrect settings');
    });

    test('Ensure async registry works', async () => {
        const asyncRegistry = ioc.serviceContainer.get<IAsyncDisposableRegistry>(IAsyncDisposableRegistry);
        let disposed = false;
        const disposable = {
            dispose(): Promise<void> {
                disposed = true;
                return Promise.resolve();
            }
        };
        asyncRegistry.push(disposable);
        await asyncRegistry.dispose();
        expect(disposed).to.be.equal(true, "Didn't dispose during async registry cleanup");
    });
});
