// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import { workspace } from 'vscode';
import { IConfigurationService, IDisposableRegistry } from '../../../client/common/types';
import { disposeAll } from '../../../client/common/utils/resourceLifecycle';
import { IServiceContainer } from '../../../client/ioc/types';
import { getExtensionSettings } from '../../extensionSettings';
import { initialize } from '../../initialize';

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
        const asyncRegistry = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        let disposed = false;
        const disposable = {
            dispose(): Promise<void> {
                disposed = true;
                return Promise.resolve();
            },
        };
        asyncRegistry.push(disposable);
        await disposeAll(asyncRegistry);
        expect(disposed).to.be.equal(true, "Didn't dispose during async registry cleanup");
    });
});
