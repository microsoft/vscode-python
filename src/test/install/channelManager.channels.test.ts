// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Container } from 'inversify';
import * as TypeMoq from 'typemoq';
import { InstallationChannelManager } from '../../client/common/installer/channelManager';
import { IModuleInstaller } from '../../client/common/installer/types';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceContainer } from '../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Installation - channels', () => {
    let serviceManager: ServiceManager;
    let serviceContainer: IServiceContainer;

    setup(() => {
        const cont = new Container();
        serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);
    });

    test('Single channel', async () => {
        const installer = mockInstaller(true, '');
        const cm = new InstallationChannelManager(serviceContainer);
        const channels = await cm.getInstallationChannels();
        assert.equal(channels.length, 1, 'Incorrect number of channels');
        assert.equal(channels[0], installer.object, 'Incorrect installer');
    });

    test('Multiple channels', async () => {
        const installer1 = mockInstaller(true, '1');
        mockInstaller(false, '2');
        const installer3 = mockInstaller(true, '3');

        const cm = new InstallationChannelManager(serviceContainer);
        const channels = await cm.getInstallationChannels();
        assert.equal(channels.length, 2, 'Incorrect number of channels');
        assert.equal(channels[0], installer1.object, 'Incorrect installer 1');
        assert.equal(channels[0], installer3.object, 'Incorrect installer 2');
    });

    function mockInstaller(supported: boolean, name: string): TypeMoq.IMock<IModuleInstaller> {
        const installer = TypeMoq.Mock.ofType<IModuleInstaller>();
        installer
            .setup(x => x.isSupported(TypeMoq.It.isAny()))
            .returns(() => new Promise<boolean>((resolve) => resolve(true)));
        serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, installer.object, name);
        return installer;
    }
});
