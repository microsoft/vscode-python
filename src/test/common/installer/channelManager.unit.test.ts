// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../../client/common/application/types';
import { InstallationChannelManager } from '../../../client/common/installer/channelManager';
import { IModuleInstaller } from '../../../client/common/installer/types';
import { Product } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

suite('xInstallationChannelManager - installation channels', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    // tslint:disable-next-line:no-any
    let getInstallationChannels: sinon.SinonStub<any>;
    // tslint:disable-next-line:no-any
    let showNoInstallersMessage: sinon.SinonStub<any>;
    const resource = Uri.parse('a');
    let installChannelManager: InstallationChannelManager;

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        serviceContainer
            .setup(s => s.get<IApplicationShell>(IApplicationShell))
            .returns(() => appShell.object);
    });

    teardown(() => {
        sinon.restore();
    });

    test('If there is exactly one installation channel, return it', async () => {
        const moduleInstaller = TypeMoq.Mock.ofType<IModuleInstaller>();
        moduleInstaller
            .setup(m => m.name)
            .returns(() => 'singleChannel');
        moduleInstaller
            // tslint:disable-next-line:no-any
            .setup(m => (m as any).then)
            .returns(() => undefined);
        getInstallationChannels = sinon.stub(InstallationChannelManager.prototype, 'getInstallationChannels');
        getInstallationChannels.resolves([moduleInstaller.object]);
        showNoInstallersMessage = sinon.stub(InstallationChannelManager.prototype, 'showNoInstallersMessage');
        showNoInstallersMessage.resolves();
        installChannelManager = new InstallationChannelManager(serviceContainer.object);
        // tslint:disable-next-line:no-any
        const channel = await installChannelManager.getInstallationChannel(undefined as any, resource);
        expect(channel).to.not.equal(undefined, 'Channel should be set');
        expect(channel!.name).to.equal('singleChannel');
    });

    test('If no channels are returned by the resource, show no installer message and return', async () => {
        getInstallationChannels = sinon.stub(InstallationChannelManager.prototype, 'getInstallationChannels');
        getInstallationChannels.resolves([]);
        showNoInstallersMessage = sinon.stub(InstallationChannelManager.prototype, 'showNoInstallersMessage');
        showNoInstallersMessage.resolves();
        installChannelManager = new InstallationChannelManager(serviceContainer.object);
        // tslint:disable-next-line:no-any
        const channel = await installChannelManager.getInstallationChannel(Product.autopep8, resource);
        expect(channel).to.equal(undefined, 'should be undefined');
        assert.ok(showNoInstallersMessage.calledOnceWith(resource));
    });

    test('If multiple channels are returned by the resource, show quick pick of the channel names and return the selected channel installer', async () => {
        const moduleInstaller1 = TypeMoq.Mock.ofType<IModuleInstaller>();
        moduleInstaller1
            .setup(m => m.displayName)
            .returns(() => 'moduleInstaller1');
        moduleInstaller1
            // tslint:disable-next-line:no-any
            .setup(m => (m as any).then)
            .returns(() => undefined);
        const moduleInstaller2 = TypeMoq.Mock.ofType<IModuleInstaller>();
        moduleInstaller2
            .setup(m => m.displayName)
            .returns(() => 'moduleInstaller2');
        moduleInstaller2
            // tslint:disable-next-line:no-any
            .setup(m => (m as any).then)
            .returns(() => undefined);
        const selection = {
            label: 'some label',
            description: '',
            installer: moduleInstaller2.object
        };
        appShell
            .setup(a => a.showQuickPick<typeof selection>(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(selection))
            .verifiable(TypeMoq.Times.once());
        getInstallationChannels = sinon.stub(InstallationChannelManager.prototype, 'getInstallationChannels');
        getInstallationChannels.resolves([moduleInstaller1.object, moduleInstaller2.object]);
        showNoInstallersMessage = sinon.stub(InstallationChannelManager.prototype, 'showNoInstallersMessage');
        showNoInstallersMessage.resolves();
        installChannelManager = new InstallationChannelManager(serviceContainer.object);
        // tslint:disable-next-line:no-any
        const channel = await installChannelManager.getInstallationChannel(Product.autopep8, resource);
        assert.ok(showNoInstallersMessage.notCalled);
        appShell.verifyAll();
        expect(channel).to.not.equal(undefined, 'Channel should be set');
        expect(channel!.displayName).to.equal('moduleInstaller2');
    });
});
