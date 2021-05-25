// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { IApplicationShell, IJupyterExtensionDependencyManager } from '../../client/common/application/types';
import { IPersistentStateFactory, IPersistentState } from '../../client/common/types';
import { Jupyter, Common } from '../../client/common/utils/localize';
import {
    jupyterExtensionNotInstalledKey,
    JupyterNotInstalledNotificationHelper,
} from '../../client/jupyter/jupyterNotInstalledNotificationHelper';
import { JupyterNotInstalledOrigin } from '../../client/jupyter/types';

suite('Jupyter not installed notification helper', () => {
    let appShell: IApplicationShell;
    let persistentStateFactory: IPersistentStateFactory;
    let jupyterExtDependencyManager: IJupyterExtensionDependencyManager;

    setup(() => {
        appShell = mock<IApplicationShell>();
        persistentStateFactory = mock<IPersistentStateFactory>();
        jupyterExtDependencyManager = mock<IJupyterExtensionDependencyManager>();
    });

    test('Notification check should return false if the Jupyter extension is installed', () => {
        const persistentState = mock<IPersistentState<boolean | undefined>>();
        when(persistentState.value).thenReturn(undefined);

        when(
            persistentStateFactory.createGlobalPersistentState(jupyterExtensionNotInstalledKey, anything()),
        ).thenReturn(instance(persistentState));

        when(jupyterExtDependencyManager.isJupyterExtensionInstalled).thenReturn(true);

        const notificationHelper = new JupyterNotInstalledNotificationHelper(
            instance(appShell),
            instance(persistentStateFactory),
            instance(jupyterExtDependencyManager),
        );

        const result = notificationHelper.shouldShowJupypterExtensionNotInstalledPrompt();

        assert.strictEqual(result, false);
        verify(persistentStateFactory.createGlobalPersistentState(jupyterExtensionNotInstalledKey, anything())).once();
        verify(jupyterExtDependencyManager.isJupyterExtensionInstalled).once();
    });

    test('Notification check should return false if the doNotShowAgain persistent value is set', () => {
        const persistentState = mock<IPersistentState<boolean | undefined>>();
        when(persistentState.value).thenReturn(true);

        when(
            persistentStateFactory.createGlobalPersistentState(jupyterExtensionNotInstalledKey, anything()),
        ).thenReturn(instance(persistentState));

        when(jupyterExtDependencyManager.isJupyterExtensionInstalled).thenReturn(true);

        const notificationHelper = new JupyterNotInstalledNotificationHelper(
            instance(appShell),
            instance(persistentStateFactory),
            instance(jupyterExtDependencyManager),
        );

        const result = notificationHelper.shouldShowJupypterExtensionNotInstalledPrompt();

        assert.strictEqual(result, false);
        verify(persistentStateFactory.createGlobalPersistentState(jupyterExtensionNotInstalledKey, anything())).once();
        verify(jupyterExtDependencyManager.isJupyterExtensionInstalled).never();
    });

    test('Notification check should return true if the doNotShowAgain persistent value is not set and the Jupyter extension is not installed', () => {
        const persistentState = mock<IPersistentState<boolean | undefined>>();
        when(persistentState.value).thenReturn(undefined);

        when(
            persistentStateFactory.createGlobalPersistentState(jupyterExtensionNotInstalledKey, anything()),
        ).thenReturn(instance(persistentState));

        when(jupyterExtDependencyManager.isJupyterExtensionInstalled).thenReturn(false);

        const notificationHelper = new JupyterNotInstalledNotificationHelper(
            instance(appShell),
            instance(persistentStateFactory),
            instance(jupyterExtDependencyManager),
        );

        const result = notificationHelper.shouldShowJupypterExtensionNotInstalledPrompt();

        assert.strictEqual(result, true);
        verify(persistentStateFactory.createGlobalPersistentState(jupyterExtensionNotInstalledKey, anything())).once();
        verify(jupyterExtDependencyManager.isJupyterExtensionInstalled).once();
    });

    test('Selecting "Do not show again" should set the doNotShowAgain persistent value', async () => {
        const persistentState = mock<IPersistentState<boolean | undefined>>();

        when(
            persistentStateFactory.createGlobalPersistentState(jupyterExtensionNotInstalledKey, anything()),
        ).thenReturn(instance(persistentState));

        when(
            appShell.showInformationMessage(Jupyter.jupyterExtensionNotInstalled(), Common.doNotShowAgain()),
        ).thenReturn(Promise.resolve(Common.doNotShowAgain()));

        const notificationHelper = new JupyterNotInstalledNotificationHelper(
            instance(appShell),
            instance(persistentStateFactory),
            instance(jupyterExtDependencyManager),
        );

        await notificationHelper.jupyterNotInstalledPrompt(JupyterNotInstalledOrigin.StartPageCreateBlankNotebook);

        verify(persistentStateFactory.createGlobalPersistentState(jupyterExtensionNotInstalledKey, false)).once();
        verify(persistentState.updateValue(true)).once();
    });

    test('Selecting "Do not show again" should make the prompt check return false', async () => {
        const persistentState = mock<IPersistentState<boolean | undefined>>();

        when(
            persistentStateFactory.createGlobalPersistentState(jupyterExtensionNotInstalledKey, anything()),
        ).thenReturn(instance(persistentState));

        when(
            appShell.showInformationMessage(Jupyter.jupyterExtensionNotInstalled(), Common.doNotShowAgain()),
        ).thenReturn(Promise.resolve(Common.doNotShowAgain()));

        const notificationHelper = new JupyterNotInstalledNotificationHelper(
            instance(appShell),
            instance(persistentStateFactory),
            instance(jupyterExtDependencyManager),
        );

        await notificationHelper.jupyterNotInstalledPrompt(JupyterNotInstalledOrigin.StartPageCreateBlankNotebook);
        const result = notificationHelper.shouldShowJupypterExtensionNotInstalledPrompt();

        assert.strictEqual(result, false);
    });
});
