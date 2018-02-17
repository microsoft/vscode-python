// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Container } from 'inversify';
import * as TypeMoq from 'typemoq';
import { QuickPickOptions } from 'vscode';
import { IApplicationShell } from '../../client/common/application/types';
import { InstallationChannelManager } from '../../client/common/installer/channelManager';
import { IModuleInstaller } from '../../client/common/installer/types';
import { Product } from '../../client/common/types';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceContainer } from '../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Installation - installation channels', () => {
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
        assert.equal(channels[1], installer3.object, 'Incorrect installer 2');
    });

    test('Select installer', async () => {
        const installer1 = mockInstaller(true, '1');
        const installer2 = mockInstaller(true, '2');

        const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);

        // tslint:disable-next-line:no-any
        let items: any[] | undefined;
        appShell
            .setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .callback((i: string[], o: QuickPickOptions) => {
                items = i;
            })
            .returns(() => new Promise<string | undefined>((resolve, reject) => resolve(undefined)));

        installer1.setup(x => x.displayName).returns(() => 'Name 1');
        installer2.setup(x => x.displayName).returns(() => 'Name 2');

        const cm = new InstallationChannelManager(serviceContainer);
        await cm.getInstallationChannel(Product.pylint);

        assert.notEqual(items, undefined, 'showQuickPick not called');
        assert.equal(items!.length, 2, 'Incorrect number of installer shown');
        assert.notEqual(items![0]!.label!.indexOf('Name 1'), -1, 'Incorrect first installer name');
        assert.notEqual(items![1]!.label!.indexOf('Name 2'), -1, 'Incorrect second installer name');
    });

    function mockInstaller(supported: boolean, name: string): TypeMoq.IMock<IModuleInstaller> {
        const installer = TypeMoq.Mock.ofType<IModuleInstaller>();
        installer
            .setup(x => x.isSupported(TypeMoq.It.isAny()))
            .returns(() => new Promise<boolean>((resolve) => resolve(supported)));
        serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, installer.object, name);
        return installer;
    }
});
