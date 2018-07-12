// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import * as TypeMoq from 'typemoq';
import { ConfigurationChangeEvent, Disposable } from 'vscode';
import { ExtensionActivationService } from '../../client/activation/activationService';
import { ExtensionActivators, IExtensionActivationService, IExtensionActivator } from '../../client/activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../client/common/application/types';
import { isLanguageServerTest } from '../../client/common/constants';
import { IConfigurationService, IDisposableRegistry, IOutputChannel, IPythonSettings } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';

suite('Activation - ActivationService', () => {
    [true, false].forEach(jediIsEnabled => {
        suite(`Jedi is ${jediIsEnabled ? 'enabled' : 'disabled'}`, () => {
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let pythonSettings: TypeMoq.IMock<IPythonSettings>;
            let appShell: TypeMoq.IMock<IApplicationShell>;
            let cmdManager: TypeMoq.IMock<ICommandManager>;
            let workspaceService: TypeMoq.IMock<IWorkspaceService>;
            setup(function () {
                if (isLanguageServerTest()) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
                serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                appShell = TypeMoq.Mock.ofType<IApplicationShell>();
                workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                cmdManager = TypeMoq.Mock.ofType<ICommandManager>();
                const configService = TypeMoq.Mock.ofType<IConfigurationService>();
                pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();

                workspaceService.setup(w => w.hasWorkspaceFolders).returns(() => false);
                workspaceService.setup(w => w.workspaceFolders).returns(() => []);
                configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

                const output = TypeMoq.Mock.ofType<IOutputChannel>();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny())).returns(() => output.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICommandManager))).returns(() => cmdManager.object);
            });

            async function testActivation(activationService: IExtensionActivationService, activator: TypeMoq.IMock<IExtensionActivator>) {
                activator
                    .setup(a => a.activate()).returns(() => Promise.resolve(true))
                    .verifiable(TypeMoq.Times.once());
                const activatorName = jediIsEnabled ? ExtensionActivators.Jedi : ExtensionActivators.DotNet;
                serviceContainer
                    .setup(c => c.get(TypeMoq.It.isValue(IExtensionActivator), TypeMoq.It.isValue(activatorName)))
                    .returns(() => activator.object)
                    .verifiable(TypeMoq.Times.once());

                await activationService.activate();

                activator.verifyAll();
                serviceContainer.verifyAll();
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
