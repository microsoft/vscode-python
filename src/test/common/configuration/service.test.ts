// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import { workspace } from 'vscode';
import { IAsyncDisposableRegistry, IConfigurationService } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { getExtensionSettings } from '../../common';
import { initialize } from '../../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Configuration Service', () => {
    let serviceContainer: IServiceContainer;
    suiteSetup(async () => {
        serviceContainer = (await initialize()).serviceContainer;
    });

    test('Ensure same instance of settings return', () => {
        const workspaceUri = workspace.workspaceFolders![0].uri;
        const settings = serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(workspaceUri);
        const instanceIsSame = settings === getExtensionSettings(workspaceUri);
        expect(instanceIsSame).to.be.equal(true, 'Incorrect settings');
    });

    test('Ensure async registry works', async () => {
        const asyncRegistry = serviceContainer.get<IAsyncDisposableRegistry>(IAsyncDisposableRegistry);
        let disposed = false;
        const disposable = {
            dispose(): Promise<void> {
                disposed = true;
                return Promise.resolve();
            },
        };
        asyncRegistry.push(disposable);
        await asyncRegistry.dispose();
        expect(disposed).to.be.equal(true, "Didn't dispose during async registry cleanup");
    });
});
