// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { IApplicationShell, IJupyterExtensionDependencyManager } from '../../client/common/application/types';
import { IPersistentStateFactory } from '../../client/common/types';
import { Jupyter, Common } from '../../client/common/utils/localize';
import {
    jupyterExtensionNotInstalledKey,
    JupyterNotInstalledNotificationHelper,
} from '../../client/jupyter/jupyterNotInstalledNotificationHelper';
import { JupyterNotInstalledOrigin } from '../../client/jupyter/types';

suite('Jupyter not installed notification helper', () => {
    teardown(() => {
        sinon.restore();
    });

    test('Notification check should return false if the Jupyter extension is installed', () => {
        const createGlobalPersistentStateStub = sinon
            .stub()
            .withArgs(jupyterExtensionNotInstalledKey, sinon.match.bool)
            .returns({ value: undefined });

        // Need to define 'isJupyterExtensionInstalled' for it to be stubbed.
        const jupyterExtDependencyManager = {
            isJupyterExtensionInstalled: false,
        } as IJupyterExtensionDependencyManager;
        const isJupyterExtensionInstalledStub = sinon.stub().returns(true);
        sinon.stub(jupyterExtDependencyManager, 'isJupyterExtensionInstalled').get(isJupyterExtensionInstalledStub);

        const notificationHelper = new JupyterNotInstalledNotificationHelper(
            {} as IApplicationShell,
            ({ createGlobalPersistentState: createGlobalPersistentStateStub } as unknown) as IPersistentStateFactory,
            jupyterExtDependencyManager,
        );

        const result = notificationHelper.shouldShowJupypterExtensionNotInstalledPrompt();

        assert.strictEqual(result, false);
        sinon.assert.calledOnce(createGlobalPersistentStateStub);
        sinon.assert.calledWith(createGlobalPersistentStateStub, jupyterExtensionNotInstalledKey, sinon.match.bool);
        sinon.assert.calledOnce(isJupyterExtensionInstalledStub);
    });

    test('Notification check should return false if the doNotShowAgain persistent value is set', () => {
        const createGlobalPersistentStateStub = sinon
            .stub()
            .withArgs(jupyterExtensionNotInstalledKey, sinon.match.bool)
            .returns({ value: true });

        const jupyterExtDependencyManager = {
            isJupyterExtensionInstalled: false,
        } as IJupyterExtensionDependencyManager;
        const isJupyterExtensionInstalledStub = sinon.stub().returns(false);
        sinon.stub(jupyterExtDependencyManager, 'isJupyterExtensionInstalled').get(isJupyterExtensionInstalledStub);

        const notificationHelper = new JupyterNotInstalledNotificationHelper(
            {} as IApplicationShell,
            ({ createGlobalPersistentState: createGlobalPersistentStateStub } as unknown) as IPersistentStateFactory,
            jupyterExtDependencyManager,
        );

        const result = notificationHelper.shouldShowJupypterExtensionNotInstalledPrompt();

        assert.strictEqual(result, false);
        sinon.assert.calledOnce(createGlobalPersistentStateStub);
        sinon.assert.calledWith(createGlobalPersistentStateStub, jupyterExtensionNotInstalledKey, sinon.match.bool);
        sinon.assert.notCalled(isJupyterExtensionInstalledStub);
    });

    test('Notification check should return true if the doNotShowAgain persistent value is not set and the Jupyter extension is not installed', () => {
        const createGlobalPersistentStateStub = sinon
            .stub()
            .withArgs(jupyterExtensionNotInstalledKey, sinon.match.bool)
            .returns({ value: undefined });

        const jupyterExtDependencyManager = {
            isJupyterExtensionInstalled: false,
        } as IJupyterExtensionDependencyManager;
        const isJupyterExtensionInstalledStub = sinon.stub().returns(false);
        sinon.stub(jupyterExtDependencyManager, 'isJupyterExtensionInstalled').get(isJupyterExtensionInstalledStub);

        const notificationHelper = new JupyterNotInstalledNotificationHelper(
            {} as IApplicationShell,
            ({ createGlobalPersistentState: createGlobalPersistentStateStub } as unknown) as IPersistentStateFactory,
            (jupyterExtDependencyManager as unknown) as IJupyterExtensionDependencyManager,
        );

        const result = notificationHelper.shouldShowJupypterExtensionNotInstalledPrompt();

        assert.strictEqual(result, true);
        sinon.assert.calledOnce(createGlobalPersistentStateStub);
        sinon.assert.calledWith(createGlobalPersistentStateStub, jupyterExtensionNotInstalledKey, sinon.match.bool);
        sinon.assert.calledOnce(isJupyterExtensionInstalledStub);
    });

    test('Selecting "Do not show again" should set the doNotShowAgain persistent value', async () => {
        const updateValueStub = sinon.stub();
        const createGlobalPersistentStateStub = sinon
            .stub()
            .withArgs(jupyterExtensionNotInstalledKey, sinon.match.bool)
            .returns({ updateValue: updateValueStub });

        const showInformationMessageStub = sinon.stub().returns(Promise.resolve(Common.doNotShowAgain));

        const notificationHelper = new JupyterNotInstalledNotificationHelper(
            ({ showInformationMessage: showInformationMessageStub } as unknown) as IApplicationShell,
            ({ createGlobalPersistentState: createGlobalPersistentStateStub } as unknown) as IPersistentStateFactory,
            {} as IJupyterExtensionDependencyManager,
        );
        await notificationHelper.showJupyterNotInstalledPrompt(JupyterNotInstalledOrigin.StartPageOpenBlankNotebook);

        sinon.assert.calledOnce(createGlobalPersistentStateStub);
        sinon.assert.calledOnce(showInformationMessageStub);
        sinon.assert.calledWith(
            showInformationMessageStub,
            Jupyter.jupyterExtensionNotInstalled(),
            Common.doNotShowAgain(),
        );
        sinon.assert.calledOnce(updateValueStub);
        sinon.assert.calledWith(updateValueStub, true);
    });

    test('Selecting "Do not show again" should make the prompt check return false', async () => {
        const persistentState: { value: boolean | undefined; updateValue: (v: boolean) => void } = {
            value: undefined,
            updateValue(v: boolean) {
                this.value = v;
            },
        };
        const createGlobalPersistentStateStub = sinon
            .stub()
            .withArgs(jupyterExtensionNotInstalledKey, sinon.match.bool)
            .returns(persistentState);

        const showInformationMessageStub = sinon.stub().returns(Promise.resolve(Common.doNotShowAgain));

        const notificationHelper = new JupyterNotInstalledNotificationHelper(
            ({ showInformationMessage: showInformationMessageStub } as unknown) as IApplicationShell,
            ({ createGlobalPersistentState: createGlobalPersistentStateStub } as unknown) as IPersistentStateFactory,
            {} as IJupyterExtensionDependencyManager,
        );
        await notificationHelper.showJupyterNotInstalledPrompt(JupyterNotInstalledOrigin.StartPageOpenBlankNotebook);

        const result = notificationHelper.shouldShowJupypterExtensionNotInstalledPrompt();

        assert.strictEqual(result, false);
    });
});
