// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { ConfigurationChangeEvent, Disposable, Uri } from 'vscode';
import { LanguageServerExtensionActivationService } from '../../client/activation/activationService';
import {
    FolderVersionPair,
    IExtensionActivationService,
    ILanguageServerActivator,
    ILanguageServerFolderService,
    LanguageServerActivator
} from '../../client/activation/types';
import { LSNotSupportedDiagnosticServiceId } from '../../client/application/diagnostics/checks/lsNotSupported';
import { IDiagnostic, IDiagnosticsService } from '../../client/application/diagnostics/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../client/common/application/types';
import { IPlatformService } from '../../client/common/platform/types';
import { IConfigurationService, IDisposable, IDisposableRegistry, IOutputChannel, IPersistentState, IPersistentStateFactory, IPythonSettings, Resource } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';

// tslint:disable:no-any

suite('Activation - ActivationService', () => {
    [true, false].forEach(jediIsEnabled => {
        suite(`Jedi is ${jediIsEnabled ? 'enabled' : 'disabled'}`, () => {
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let pythonSettings: TypeMoq.IMock<IPythonSettings>;
            let appShell: TypeMoq.IMock<IApplicationShell>;
            let cmdManager: TypeMoq.IMock<ICommandManager>;
            let workspaceService: TypeMoq.IMock<IWorkspaceService>;
            let platformService: TypeMoq.IMock<IPlatformService>;
            let lsNotSupportedDiagnosticService: TypeMoq.IMock<IDiagnosticsService>;
            let stateFactory: TypeMoq.IMock<IPersistentStateFactory>;
            let state: TypeMoq.IMock<IPersistentState<boolean | undefined>>;
            setup(() => {
                serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                appShell = TypeMoq.Mock.ofType<IApplicationShell>();
                workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                cmdManager = TypeMoq.Mock.ofType<ICommandManager>();
                platformService = TypeMoq.Mock.ofType<IPlatformService>();
                stateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
                state = TypeMoq.Mock.ofType<IPersistentState<boolean | undefined>>();
                const configService = TypeMoq.Mock.ofType<IConfigurationService>();
                pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
                const langFolderServiceMock = TypeMoq.Mock.ofType<ILanguageServerFolderService>();
                const folderVer: FolderVersionPair = {
                    path: '',
                    version: new SemVer('1.2.3')
                };
                lsNotSupportedDiagnosticService = TypeMoq.Mock.ofType<IDiagnosticsService>();
                workspaceService.setup(w => w.hasWorkspaceFolders).returns(() => false);
                workspaceService.setup(w => w.workspaceFolders).returns(() => []);
                configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
                langFolderServiceMock
                    .setup(l => l.getCurrentLanguageServerDirectory())
                    .returns(() => Promise.resolve(folderVer));
                stateFactory.setup(f => f.createGlobalPersistentState(TypeMoq.It.isValue('SWITCH_LS'), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .returns(() => state.object);
                state.setup(s => s.value).returns(() => undefined);
                state.setup(s => s.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());
                const output = TypeMoq.Mock.ofType<IOutputChannel>();
                serviceContainer
                    .setup(c => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny()))
                    .returns(() => output.object);
                serviceContainer
                    .setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService)))
                    .returns(() => workspaceService.object);
                serviceContainer
                    .setup(c => c.get(TypeMoq.It.isValue(IApplicationShell)))
                    .returns(() => appShell.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
                serviceContainer
                    .setup(c => c.get(TypeMoq.It.isValue(IConfigurationService)))
                    .returns(() => configService.object);
                serviceContainer
                    .setup(c => c.get(TypeMoq.It.isValue(ICommandManager)))
                    .returns(() => cmdManager.object);
                serviceContainer
                    .setup(c => c.get(TypeMoq.It.isValue(IPlatformService)))
                    .returns(() => platformService.object);
                serviceContainer
                    .setup(c => c.get(TypeMoq.It.isValue(ILanguageServerFolderService)))
                    .returns(() => langFolderServiceMock.object);
                serviceContainer
                    .setup(s =>
                        s.get(
                            TypeMoq.It.isValue(IDiagnosticsService),
                            TypeMoq.It.isValue(LSNotSupportedDiagnosticServiceId)
                        )
                    )
                    .returns(() => lsNotSupportedDiagnosticService.object);
            });

            async function testActivation(
                activationService: IExtensionActivationService,
                activator: TypeMoq.IMock<ILanguageServerActivator>,
                lsSupported: boolean = true
            ) {
                activator
                    .setup(a => a.activate(undefined))
                    .returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.once());
                let activatorName = LanguageServerActivator.Jedi;
                if (lsSupported && !jediIsEnabled) {
                    activatorName = LanguageServerActivator.DotNet;
                }
                let diagnostics: IDiagnostic[];
                if (!lsSupported && !jediIsEnabled) {
                    diagnostics = [TypeMoq.It.isAny()];
                } else {
                    diagnostics = [];
                }
                lsNotSupportedDiagnosticService
                    .setup(l => l.diagnose(undefined))
                    .returns(() => Promise.resolve(diagnostics));
                lsNotSupportedDiagnosticService
                    .setup(l => l.handle(TypeMoq.It.isValue(diagnostics)))
                    .returns(() => Promise.resolve());
                serviceContainer
                    .setup(c => c.get(TypeMoq.It.isValue(ILanguageServerActivator), TypeMoq.It.isValue(activatorName)))
                    .returns(() => activator.object)
                    .verifiable(TypeMoq.Times.once());

                await activationService.activate(undefined);

                activator.verifyAll();
                serviceContainer.verifyAll();
            }

            test('LS is supported', async () => {
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);

                await testActivation(activationService, activator, true);
            });
            test('LS is not supported', async () => {
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);

                await testActivation(activationService, activator, false);
            });

            test('Activatory must be activated', async () => {
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);

                await testActivation(activationService, activator);
            });
            test('Activatory must be deactivated', async () => {
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);

                await testActivation(activationService, activator);

                activator
                    .setup(a => a.dispose())
                    .verifiable(TypeMoq.Times.once());

                activationService.dispose();
                activator.verifyAll();
            });
            test('Prompt user to reload VS Code and reload, when setting is toggled', async () => {
                let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                let jediIsEnabledValueInSetting = jediIsEnabled;
                workspaceService
                    .setup(w => w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .callback(cb => (callbackHandler = cb))
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabledValueInSetting);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);

                workspaceService.verifyAll();
                await testActivation(activationService, activator);

                const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
                event
                    .setup(e => e.affectsConfiguration(TypeMoq.It.isValue('python.jediEnabled'), TypeMoq.It.isAny()))
                    .returns(() => true)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                appShell
                    .setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isValue('Reload')))
                    .returns(() => Promise.resolve('Reload'))
                    .verifiable(TypeMoq.Times.once());
                cmdManager
                    .setup(c => c.executeCommand(TypeMoq.It.isValue('workbench.action.reloadWindow')))
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
                    .callback(cb => (callbackHandler = cb))
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabledValueInSetting);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);

                workspaceService.verifyAll();
                await testActivation(activationService, activator);

                const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
                event
                    .setup(e => e.affectsConfiguration(TypeMoq.It.isValue('python.jediEnabled'), TypeMoq.It.isAny()))
                    .returns(() => true)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                appShell
                    .setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isValue('Reload')))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.once());
                cmdManager
                    .setup(c => c.executeCommand(TypeMoq.It.isValue('workbench.action.reloadWindow')))
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
                    .callback(cb => (callbackHandler = cb))
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);

                workspaceService.verifyAll();
                await testActivation(activationService, activator);

                const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
                event
                    .setup(e => e.affectsConfiguration(TypeMoq.It.isValue('python.jediEnabled'), TypeMoq.It.isAny()))
                    .returns(() => true)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                appShell
                    .setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isValue('Reload')))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.never());
                cmdManager
                    .setup(c => c.executeCommand(TypeMoq.It.isValue('workbench.action.reloadWindow')))
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
                    .callback(cb => (callbackHandler = cb))
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);

                workspaceService.verifyAll();
                await testActivation(activationService, activator);

                const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
                event
                    .setup(e => e.affectsConfiguration(TypeMoq.It.isValue('python.jediEnabled'), TypeMoq.It.isAny()))
                    .returns(() => false)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                appShell
                    .setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isValue('Reload')))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.never());
                cmdManager
                    .setup(c => c.executeCommand(TypeMoq.It.isValue('workbench.action.reloadWindow')))
                    .verifiable(TypeMoq.Times.never());

                // Invoke the config changed callback.
                await callbackHandler(event.object);

                event.verifyAll();
                appShell.verifyAll();
                cmdManager.verifyAll();
            });
            test('Track current LS usage for first usage', async () => {
                state.reset();
                state.setup(s => s.value).returns(() => undefined).verifiable(TypeMoq.Times.once());
                state.setup(s => s.updateValue(TypeMoq.It.isValue(true))).returns(() => Promise.resolve()).verifiable(TypeMoq.Times.once());

                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);
                await activationService.trackLangaugeServerSwitch(true);

                state.verifyAll();
            });
            test('Track switch to LS', async () => {
                state.reset();
                state.setup(s => s.value).returns(() => true).verifiable(TypeMoq.Times.once());
                state.setup(s => s.updateValue(TypeMoq.It.isValue(false))).returns(() => Promise.resolve()).verifiable(TypeMoq.Times.once());

                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);
                await activationService.trackLangaugeServerSwitch(false);

                state.verify(s => s.updateValue(TypeMoq.It.isValue(false)), TypeMoq.Times.once());
            });
            test('Track switch to Jedi', async () => {
                state.reset();
                state.setup(s => s.value).returns(() => false).verifiable(TypeMoq.Times.once());
                state.setup(s => s.updateValue(TypeMoq.It.isValue(true))).returns(() => Promise.resolve()).verifiable(TypeMoq.Times.once());

                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);
                await activationService.trackLangaugeServerSwitch(true);

                state.verify(s => s.updateValue(TypeMoq.It.isValue(true)), TypeMoq.Times.once());
            });
            if (!jediIsEnabled) {
                test('Revert to jedi when LS activation fails', async () => {
                    pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                    const activatorDotNet = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activatorJedi = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);
                    const diagnostics: IDiagnostic[] = [];
                    lsNotSupportedDiagnosticService
                        .setup(l => l.diagnose(undefined))
                        .returns(() => Promise.resolve(diagnostics));
                    lsNotSupportedDiagnosticService
                        .setup(l => l.handle(TypeMoq.It.isValue(diagnostics)))
                        .returns(() => Promise.resolve());
                    serviceContainer
                        .setup(c =>
                            c.get(
                                TypeMoq.It.isValue(ILanguageServerActivator),
                                TypeMoq.It.isValue(LanguageServerActivator.DotNet)
                            )
                        )
                        .returns(() => activatorDotNet.object)
                        .verifiable(TypeMoq.Times.once());
                    activatorDotNet
                        .setup(a => a.activate(undefined))
                        .returns(() => Promise.reject(new Error('')))
                        .verifiable(TypeMoq.Times.once());
                    serviceContainer
                        .setup(c =>
                            c.get(
                                TypeMoq.It.isValue(ILanguageServerActivator),
                                TypeMoq.It.isValue(LanguageServerActivator.Jedi)
                            )
                        )
                        .returns(() => activatorJedi.object)
                        .verifiable(TypeMoq.Times.once());
                    activatorJedi
                        .setup(a => a.activate(undefined))
                        .returns(() => Promise.resolve())
                        .verifiable(TypeMoq.Times.once());

                    await activationService.activate(undefined);

                    activatorDotNet.verifyAll();
                    activatorJedi.verifyAll();
                    serviceContainer.verifyAll();
                });
                async function testActivationOfResource(
                    activationService: IExtensionActivationService,
                    activator: TypeMoq.IMock<ILanguageServerActivator>,
                    resource: Resource
                ) {
                    activator
                        .setup(a => a.activate(resource))
                        .returns(() => Promise.resolve())
                        .verifiable(TypeMoq.Times.once());
                    lsNotSupportedDiagnosticService
                        .setup(l => l.diagnose(undefined))
                        .returns(() => Promise.resolve([]));
                    lsNotSupportedDiagnosticService
                        .setup(l => l.handle(TypeMoq.It.isValue([])))
                        .returns(() => Promise.resolve());
                    serviceContainer
                        .setup(c => c.get(TypeMoq.It.isValue(ILanguageServerActivator), TypeMoq.It.isValue(LanguageServerActivator.DotNet)))
                        .returns(() => activator.object)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                    workspaceService
                        .setup(w => w.getWorkspaceFolderIdentifier(resource, ''))
                        .returns(() => resource!.fsPath)
                        .verifiable(TypeMoq.Times.atLeastOnce());

                    await activationService.activate(resource);

                    activator.verifyAll();
                    serviceContainer.verifyAll();
                    workspaceService.verifyAll();
                }
                test('Activator is disposed if activated workspace is removed', async () => {
                    pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                    let workspaceFoldersChangedHandler!: Function;
                    workspaceService
                        .setup(w => w.onDidChangeWorkspaceFolders(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                        .callback(cb => (workspaceFoldersChangedHandler = cb))
                        .returns(() => TypeMoq.Mock.ofType<IDisposable>().object)
                        .verifiable(TypeMoq.Times.once());
                    const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);
                    workspaceService.verifyAll();
                    expect(workspaceFoldersChangedHandler).not.to.be.equal(undefined, 'Handler not set');
                    const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
                    const folder2 = { name: 'two', uri: Uri.parse('two'), index: 2 };
                    const folder3 = { name: 'three', uri: Uri.parse('three'), index: 3 };

                    const activator1 = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    await testActivationOfResource(activationService, activator1, folder1.uri);
                    const activator2 = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    await testActivationOfResource(activationService, activator2, folder2.uri);
                    const activator3 = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    await testActivationOfResource(activationService, activator3, folder3.uri);

                    //Now remove folder3
                    workspaceService.reset();
                    workspaceService.setup(w => w.workspaceFolders).returns(() => [folder1, folder2]);
                    workspaceService
                        .setup(w => w.getWorkspaceFolderIdentifier(folder1.uri, ''))
                        .returns(() => folder1.uri.fsPath)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                    workspaceService
                        .setup(w => w.getWorkspaceFolderIdentifier(folder2.uri, ''))
                        .returns(() => folder2.uri.fsPath)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                    activator1
                        .setup(d => d.dispose())
                        .verifiable(TypeMoq.Times.never());
                    activator2
                        .setup(d => d.dispose())
                        .verifiable(TypeMoq.Times.never());
                    activator3
                        .setup(d => d.dispose())
                        .verifiable(TypeMoq.Times.once());
                    workspaceFoldersChangedHandler.call(activationService);
                    workspaceService.verifyAll();
                    activator3.verifyAll();
                });
            } else {
                test('Jedi is only activated once', async () => {
                    pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                    const activator1 = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object);
                    const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
                    const folder2 = { name: 'two', uri: Uri.parse('two'), index: 2 };
                    serviceContainer
                        .setup(c => c.get(TypeMoq.It.isValue(ILanguageServerActivator), TypeMoq.It.isValue(LanguageServerActivator.Jedi)))
                        .returns(() => activator1.object)
                        .verifiable(TypeMoq.Times.once());
                    activator1
                        .setup(a => a.activate(folder1.uri))
                        .returns(() => Promise.resolve())
                        .verifiable(TypeMoq.Times.once());
                    await activationService.activate(folder1.uri);
                    activator1.verifyAll();
                    serviceContainer.verifyAll();

                    const activator2 = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    serviceContainer
                        .setup(c => c.get(TypeMoq.It.isValue(ILanguageServerActivator), TypeMoq.It.isValue(LanguageServerActivator.Jedi)))
                        .returns(() => activator2.object)
                        .verifiable(TypeMoq.Times.once());
                    activator2
                        .setup(a => a.activate(folder2.uri))
                        .returns(() => Promise.resolve())
                        .verifiable(TypeMoq.Times.never());
                    await activationService.activate(folder2.uri);
                    serviceContainer.verifyAll();
                    activator2.verifyAll();
                });
            }
        });
    });
});
