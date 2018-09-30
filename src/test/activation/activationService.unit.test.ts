// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { ConfigurationChangeEvent, Disposable } from 'vscode';
import { ExtensionActivationService } from '../../client/activation/activationService';
import {
    ExtensionActivators, FolderVersionPair,
    IExtensionActivationService, IExtensionActivator,
    ILanguageServerFolderService
} from '../../client/activation/types';
import {
    IApplicationShell, ICommandManager,
    IWorkspaceService
} from '../../client/common/application/types';
import { isLanguageServerTest } from '../../client/common/constants';
import { IPlatformService } from '../../client/common/platform/types';
import {
    IConfigurationService, IDisposableRegistry,
    IOutputChannel, IPythonSettings
} from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { Info as PlatformInfo } from '../../utils/platform';
import * as testOSInfos from '../utils/platform.unit.test';

suite('Activation - ActivationService', () => {
    [true, false].forEach(jediIsEnabled => {
        suite(`Jedi is ${jediIsEnabled ? 'enabled' : 'disabled'}`, () => {
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let pythonSettings: TypeMoq.IMock<IPythonSettings>;
            let appShell: TypeMoq.IMock<IApplicationShell>;
            let cmdManager: TypeMoq.IMock<ICommandManager>;
            let workspaceService: TypeMoq.IMock<IWorkspaceService>;
            let platformService: TypeMoq.IMock<IPlatformService>;
            setup(function () {
                if (isLanguageServerTest()) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
                serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                appShell = TypeMoq.Mock.ofType<IApplicationShell>();
                workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                cmdManager = TypeMoq.Mock.ofType<ICommandManager>();
                platformService = TypeMoq.Mock.ofType<IPlatformService>();
                const configService = TypeMoq.Mock.ofType<IConfigurationService>();
                pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
                const langFolderServiceMock = TypeMoq.Mock.ofType<ILanguageServerFolderService>();
                const folderVer: FolderVersionPair = {
                    path: '',
                    version: new SemVer('1.2.3')
                };

                workspaceService.setup(w => w.hasWorkspaceFolders).returns(() => false);
                workspaceService.setup(w => w.workspaceFolders).returns(() => []);
                configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
                langFolderServiceMock.setup(l => l.getCurrentLanguageServerDirectory()).returns(() => Promise.resolve(folderVer));

                const output = TypeMoq.Mock.ofType<IOutputChannel>();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny())).returns(() => output.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICommandManager))).returns(() => cmdManager.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ILanguageServerFolderService))).returns(() => langFolderServiceMock.object);
            });

            async function testActivation(activationService: IExtensionActivationService, activator: TypeMoq.IMock<IExtensionActivator>, lsSupported: boolean = true) {
                activator
                    .setup(a => a.activate()).returns(() => Promise.resolve(true))
                    .verifiable(TypeMoq.Times.once());
                let activatorName = ExtensionActivators.Jedi;
                if (lsSupported && !jediIsEnabled) {
                    activatorName = ExtensionActivators.DotNet;
                }
                serviceContainer
                    .setup(c => c.get(TypeMoq.It.isValue(IExtensionActivator), TypeMoq.It.isValue(activatorName)))
                    .returns(() => activator.object)
                    .verifiable(TypeMoq.Times.once());

                await activationService.activate();

                activator.verifyAll();
                serviceContainer.verifyAll();
            }

            const supportedTests: [string, PlatformInfo][] = [
                ['win10', testOSInfos.WIN_10],
                ['win7', testOSInfos.WIN_7],
                ['high sierra', testOSInfos.MAC_HIGH_SIERRA],
                ['sierra', testOSInfos.MAC_SIERRA],
                ['ubuntu 18.04', testOSInfos.UBUNTU_BIONIC],
                ['ubuntu 14.04', testOSInfos.UBUNTU_PRECISE],
                ['fedora 24', testOSInfos.FEDORA],
                ['arch', testOSInfos.ARCH]
            ];
            for (const [osID, info] of supportedTests) {
                test(`LS is supported (${osID})`, async () => {
                    pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                    platformService.setup(p => p.info).returns(() => info);
                    const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                    const activationService = new ExtensionActivationService(serviceContainer.object);

                    await testActivation(activationService, activator, true);
                });
            }

            const unsupportedTests: [string, PlatformInfo][] = [
                ['winXP', testOSInfos.WIN_XP],
                ['el capitan', testOSInfos.MAC_EL_CAPITAN]
            ];
            for (const [osID, info] of unsupportedTests) {
                test(`LS is not supported (${osID})`, async () => {
                    pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                    platformService.setup(p => p.info).returns(() => info);
                    const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                    const activationService = new ExtensionActivationService(serviceContainer.object);

                    await testActivation(activationService, activator, false);
                });
            }

            test('Activatory must be activated', async () => {
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object);

                await testActivation(activationService, activator);
            });
            test('Activatory must be deactivated', async () => {
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object);

                await testActivation(activationService, activator);

                activator
                    .setup(a => a.deactivate()).returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.once());

                activationService.dispose();
                activator.verifyAll();
            });
            test('Prompt user to reload VS Code and reload, when setting is toggled', async () => {
                let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                let jediIsEnabledValueInSetting = jediIsEnabled;
                workspaceService
                    .setup(w => w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .callback(cb => callbackHandler = cb)
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabledValueInSetting);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object);

                workspaceService.verifyAll();
                await testActivation(activationService, activator);

                const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
                event.setup(e => e.affectsConfiguration(TypeMoq.It.isValue('python.jediEnabled'), TypeMoq.It.isAny()))
                    .returns(() => true)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isValue('Reload')))
                    .returns(() => Promise.resolve('Reload'))
                    .verifiable(TypeMoq.Times.once());
                cmdManager.setup(c => c.executeCommand(TypeMoq.It.isValue('workbench.action.reloadWindow')))
                    .verifiable(TypeMoq.Times.once());

                // Toggle the value in the setting and invoke the callback.
                jediIsEnabledValueInSetting = !jediIsEnabledValueInSetting;
                await callbackHandler(event.object);

                event.verifyAll();
                appShell.verifyAll();
                cmdManager.verifyAll();
            });
            test('Prompt user to reload VS Code and do not reload, when setting is toggled', async () => {
                let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                let jediIsEnabledValueInSetting = jediIsEnabled;
                workspaceService
                    .setup(w => w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .callback(cb => callbackHandler = cb)
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabledValueInSetting);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object);

                workspaceService.verifyAll();
                await testActivation(activationService, activator);

                const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
                event.setup(e => e.affectsConfiguration(TypeMoq.It.isValue('python.jediEnabled'), TypeMoq.It.isAny()))
                    .returns(() => true)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isValue('Reload')))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.once());
                cmdManager.setup(c => c.executeCommand(TypeMoq.It.isValue('workbench.action.reloadWindow')))
                    .verifiable(TypeMoq.Times.never());

                // Toggle the value in the setting and invoke the callback.
                jediIsEnabledValueInSetting = !jediIsEnabledValueInSetting;
                await callbackHandler(event.object);

                event.verifyAll();
                appShell.verifyAll();
                cmdManager.verifyAll();
            });
            test('Do not prompt user to reload VS Code when setting is not toggled', async () => {
                let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                workspaceService
                    .setup(w => w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .callback(cb => callbackHandler = cb)
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object);

                workspaceService.verifyAll();
                await testActivation(activationService, activator);

                const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
                event.setup(e => e.affectsConfiguration(TypeMoq.It.isValue('python.jediEnabled'), TypeMoq.It.isAny()))
                    .returns(() => true)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isValue('Reload')))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.never());
                cmdManager.setup(c => c.executeCommand(TypeMoq.It.isValue('workbench.action.reloadWindow')))
                    .verifiable(TypeMoq.Times.never());

                // Invoke the config changed callback.
                await callbackHandler(event.object);

                event.verifyAll();
                appShell.verifyAll();
                cmdManager.verifyAll();
            });
            test('Do not prompt user to reload VS Code when setting is not changed', async () => {
                let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                workspaceService
                    .setup(w => w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .callback(cb => callbackHandler = cb)
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object);

                workspaceService.verifyAll();
                await testActivation(activationService, activator);

                const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
                event.setup(e => e.affectsConfiguration(TypeMoq.It.isValue('python.jediEnabled'), TypeMoq.It.isAny()))
                    .returns(() => false)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isValue('Reload')))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.never());
                cmdManager.setup(c => c.executeCommand(TypeMoq.It.isValue('workbench.action.reloadWindow')))
                    .verifiable(TypeMoq.Times.never());

                // Invoke the config changed callback.
                await callbackHandler(event.object);

                event.verifyAll();
                appShell.verifyAll();
                cmdManager.verifyAll();
            });
        });
    });
});
