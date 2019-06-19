// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { ConfigurationChangeEvent, Disposable, Uri, WorkspaceConfiguration } from 'vscode';
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
import { LSControl, LSEnabled } from '../../client/common/experimentGroups';
import { IPlatformService } from '../../client/common/platform/types';
import { IConfigurationService, IDisposable, IDisposableRegistry, IExperimentsManager, IOutputChannel, IPersistentState, IPersistentStateFactory, IPythonSettings, Resource } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';

// tslint:disable:no-any

suite('Activation - ActivationService', () => {
    [true, false].forEach(jediIsEnabled => {
        suite(`Test activation - ${jediIsEnabled ? 'Jedi is enabled' : 'Jedi is disabled'}`, () => {
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let pythonSettings: TypeMoq.IMock<IPythonSettings>;
            let appShell: TypeMoq.IMock<IApplicationShell>;
            let cmdManager: TypeMoq.IMock<ICommandManager>;
            let workspaceService: TypeMoq.IMock<IWorkspaceService>;
            let platformService: TypeMoq.IMock<IPlatformService>;
            let lsNotSupportedDiagnosticService: TypeMoq.IMock<IDiagnosticsService>;
            let stateFactory: TypeMoq.IMock<IPersistentStateFactory>;
            let state: TypeMoq.IMock<IPersistentState<boolean | undefined>>;
            let experiments: TypeMoq.IMock<IExperimentsManager>;
            let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;
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
                experiments = TypeMoq.Mock.ofType<IExperimentsManager>();
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
                const setting = { workspaceFolderValue: jediIsEnabled };
                workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
                workspaceService.setup(ws => ws.getConfiguration('python', TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
                workspaceConfig.setup(c => c.inspect<boolean>('jediEnabled'))
                    .returns(() => setting as any);
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

                experiments
                    .setup(ex => ex.inExperiment(TypeMoq.It.isAny()))
                    .returns(() => false)
                    .verifiable(TypeMoq.Times.never());

                await activationService.activate(undefined);

                activator.verifyAll();
                serviceContainer.verifyAll();
                experiments.verifyAll();
            }

            test('LS is supported', async () => {
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);

                await testActivation(activationService, activator, true);
            });
            test('LS is not supported', async () => {
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);

                await testActivation(activationService, activator, false);
            });

            test('Activatory must be activated', async () => {
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);

                await testActivation(activationService, activator);
            });
            test('Activatory must be deactivated', async () => {
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);

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
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);

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
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);

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
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);

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
                const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);

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
            if (!jediIsEnabled) {
                test('Revert to jedi when LS activation fails', async () => {
                    pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                    const activatorDotNet = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activatorJedi = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
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
                    experiments
                        .setup(ex => ex.inExperiment(TypeMoq.It.isAny()))
                        .returns(() => false)
                        .verifiable(TypeMoq.Times.never());

                    await activationService.activate(resource);

                    activator.verifyAll();
                    serviceContainer.verifyAll();
                    workspaceService.verifyAll();
                    experiments.verifyAll();
                }
                test('Activator is disposed if activated workspace is removed', async () => {
                    pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                    let workspaceFoldersChangedHandler!: Function;
                    workspaceService
                        .setup(w => w.onDidChangeWorkspaceFolders(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                        .callback(cb => (workspaceFoldersChangedHandler = cb))
                        .returns(() => TypeMoq.Mock.ofType<IDisposable>().object)
                        .verifiable(TypeMoq.Times.once());
                    const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
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
                    const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
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
                    experiments
                        .setup(ex => ex.inExperiment(TypeMoq.It.isAny()))
                        .returns(() => false)
                        .verifiable(TypeMoq.Times.never());
                    await activationService.activate(folder1.uri);
                    activator1.verifyAll();
                    serviceContainer.verifyAll();
                    experiments.verifyAll();

                    const activator2 = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    serviceContainer
                        .setup(c => c.get(TypeMoq.It.isValue(ILanguageServerActivator), TypeMoq.It.isValue(LanguageServerActivator.Jedi)))
                        .returns(() => activator2.object)
                        .verifiable(TypeMoq.Times.once());
                    activator2
                        .setup(a => a.activate(folder2.uri))
                        .returns(() => Promise.resolve())
                        .verifiable(TypeMoq.Times.never());
                    experiments
                        .setup(ex => ex.inExperiment(TypeMoq.It.isAny()))
                        .returns(() => false)
                        .verifiable(TypeMoq.Times.never());
                    await activationService.activate(folder2.uri);
                    serviceContainer.verifyAll();
                    activator1.verifyAll();
                    activator2.verifyAll();
                    experiments.verifyAll();
                });
            }
        });
    });

    suite('Test trackLangaugeServerSwitch()', () => {
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let pythonSettings: TypeMoq.IMock<IPythonSettings>;
        let appShell: TypeMoq.IMock<IApplicationShell>;
        let cmdManager: TypeMoq.IMock<ICommandManager>;
        let workspaceService: TypeMoq.IMock<IWorkspaceService>;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let lsNotSupportedDiagnosticService: TypeMoq.IMock<IDiagnosticsService>;
        let stateFactory: TypeMoq.IMock<IPersistentStateFactory>;
        let state: TypeMoq.IMock<IPersistentState<boolean | undefined>>;
        let experiments: TypeMoq.IMock<IExperimentsManager>;
        let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;
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
            experiments = TypeMoq.Mock.ofType<IExperimentsManager>();
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
            workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            workspaceService.setup(ws => ws.getConfiguration('python', TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
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

        test('Track current LS usage for first usage', async () => {
            state.reset();
            state.setup(s => s.value).returns(() => undefined).verifiable(TypeMoq.Times.once());
            state.setup(s => s.updateValue(TypeMoq.It.isValue(true))).returns(() => Promise.resolve()).verifiable(TypeMoq.Times.once());

            const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
            await activationService.trackLangaugeServerSwitch(true);

            state.verifyAll();
        });
        test('Track switch to LS', async () => {
            state.reset();
            state.setup(s => s.value).returns(() => true).verifiable(TypeMoq.Times.once());
            state.setup(s => s.updateValue(TypeMoq.It.isValue(false))).returns(() => Promise.resolve()).verifiable(TypeMoq.Times.once());

            const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
            await activationService.trackLangaugeServerSwitch(false);

            state.verify(s => s.updateValue(TypeMoq.It.isValue(false)), TypeMoq.Times.once());
        });
        test('Track switch to Jedi', async () => {
            state.reset();
            state.setup(s => s.value).returns(() => false).verifiable(TypeMoq.Times.once());
            state.setup(s => s.updateValue(TypeMoq.It.isValue(true))).returns(() => Promise.resolve()).verifiable(TypeMoq.Times.once());

            const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
            await activationService.trackLangaugeServerSwitch(true);

            state.verify(s => s.updateValue(TypeMoq.It.isValue(true)), TypeMoq.Times.once());
        });
    });

    suite('Test useJedi()', () => {
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let pythonSettings: TypeMoq.IMock<IPythonSettings>;
        let appShell: TypeMoq.IMock<IApplicationShell>;
        let cmdManager: TypeMoq.IMock<ICommandManager>;
        let workspaceService: TypeMoq.IMock<IWorkspaceService>;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let lsNotSupportedDiagnosticService: TypeMoq.IMock<IDiagnosticsService>;
        let stateFactory: TypeMoq.IMock<IPersistentStateFactory>;
        let state: TypeMoq.IMock<IPersistentState<boolean | undefined>>;
        let experiments: TypeMoq.IMock<IExperimentsManager>;
        let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;
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
            experiments = TypeMoq.Mock.ofType<IExperimentsManager>();
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
            workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            workspaceService.setup(ws => ws.getConfiguration('python', TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
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

        test('If default value of jedi is being used, and LSEnabled experiment is enabled, then return false', async () => {
            const settings = {};
            experiments
                .setup(ex => ex.inExperiment(LSEnabled))
                .returns(() => true)
                .verifiable(TypeMoq.Times.once());
            experiments
                .setup(ex => ex.sendTelemetryIfInExperiment(TypeMoq.It.isAny()))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.never());
            workspaceConfig.setup(c => c.inspect<boolean>('jediEnabled'))
                .returns(() => settings as any)
                .verifiable(TypeMoq.Times.once());

            const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
            const result = activationService.useJedi();
            expect(result).to.equal(false, 'LS should be enabled');

            workspaceService.verifyAll();
            workspaceConfig.verifyAll();
            experiments.verifyAll();
        });

        test('If default value of jedi is being used, and LSEnabled experiment is disabled, then send telemetry if user is in Experiment LSControl and return python settings value (which will always be true as default value is true)', async () => {
            const settings = {};
            experiments
                .setup(ex => ex.inExperiment(LSEnabled))
                .returns(() => false)
                .verifiable(TypeMoq.Times.once());
            experiments
                .setup(ex => ex.sendTelemetryIfInExperiment(LSControl))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            workspaceConfig.setup(c => c.inspect<boolean>('jediEnabled'))
                .returns(() => settings as any)
                .verifiable(TypeMoq.Times.once());
            pythonSettings
                .setup(p => p.jediEnabled)
                .returns(() => true)
                .verifiable(TypeMoq.Times.once());

            const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
            const result = activationService.useJedi();
            expect(result).to.equal(true, 'Return value should be true');

            pythonSettings.verifyAll();
            experiments.verifyAll();
            workspaceService.verifyAll();
            workspaceConfig.verifyAll();
        });

        suite('If default value of jedi is not being used, then no experiments are used, and python settings value is returned', async () => {
            [
                {
                    testName: 'Returns false when python settings value is false',
                    pythonSettingsValue: false,
                    expectedResult: false
                },
                {
                    testName: 'Returns true when python settings value is true',
                    pythonSettingsValue: true,
                    expectedResult: true
                }
            ].forEach(testParams => {
                test(testParams.testName, async () => {
                    const settings = { workspaceFolderValue: true };
                    experiments
                        .setup(ex => ex.inExperiment(LSEnabled))
                        .returns(() => false)
                        .verifiable(TypeMoq.Times.never());
                    experiments
                        .setup(ex => ex.sendTelemetryIfInExperiment(LSControl))
                        .returns(() => undefined)
                        .verifiable(TypeMoq.Times.never());
                    workspaceConfig.setup(c => c.inspect<boolean>('jediEnabled'))
                        .returns(() => settings as any)
                        .verifiable(TypeMoq.Times.once());
                    pythonSettings
                        .setup(p => p.jediEnabled)
                        .returns(() => testParams.pythonSettingsValue)
                        .verifiable(TypeMoq.Times.once());

                    const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
                    const result = activationService.useJedi();
                    expect(result).to.equal(testParams.pythonSettingsValue, `Return value should be ${testParams.pythonSettingsValue}`);

                    pythonSettings.verifyAll();
                    experiments.verifyAll();
                    workspaceService.verifyAll();
                    workspaceConfig.verifyAll();
                });
            });
        });
    });

    suite('Function isJediUsingDefaultConfiguration()', () => {
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let pythonSettings: TypeMoq.IMock<IPythonSettings>;
        let appShell: TypeMoq.IMock<IApplicationShell>;
        let cmdManager: TypeMoq.IMock<ICommandManager>;
        let workspaceService: TypeMoq.IMock<IWorkspaceService>;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let lsNotSupportedDiagnosticService: TypeMoq.IMock<IDiagnosticsService>;
        let stateFactory: TypeMoq.IMock<IPersistentStateFactory>;
        let state: TypeMoq.IMock<IPersistentState<boolean | undefined>>;
        let experiments: TypeMoq.IMock<IExperimentsManager>;
        let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;
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
            experiments = TypeMoq.Mock.ofType<IExperimentsManager>();
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
            workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            workspaceService.setup(ws => ws.getConfiguration('python', TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
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
        const value = [undefined, true, false]; // Possible values of settings
        const index = [0, 1, 2]; // Index associated with each value
        const expectedResults: boolean[][][] = // Initializing a 3D array with default value `false`
            Array(3).fill(false)
                .map(() => Array(3).fill(false)
                    .map(() => Array(3).fill(false)));
        expectedResults[0][0][0] = true;
        for (const globalIndex of index) {
            for (const workspaceIndex of index) {
                for (const workspaceFolderIndex of index) {
                    const expectedResult = expectedResults[globalIndex][workspaceIndex][workspaceFolderIndex];
                    const settings = { globalValue: value[globalIndex], workspaceValue: value[workspaceIndex], workspaceFolderValue: value[workspaceFolderIndex] };
                    const testName = `Returns ${expectedResult} for setting = ${JSON.stringify(settings)}`;
                    test(testName, async () => {
                        workspaceConfig.reset();
                        workspaceConfig.setup(c => c.inspect<boolean>('jediEnabled'))
                            .returns(() => settings as any)
                            .verifiable(TypeMoq.Times.once());

                        const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
                        const result = activationService.isJediUsingDefaultConfiguration(Uri.parse('a'));
                        expect(result).to.equal(expectedResult);

                        workspaceService.verifyAll();
                        workspaceConfig.verifyAll();
                    });
                }
            }
        }
        test('Returns false for settings = undefined', async () => {
            workspaceConfig.reset();
            workspaceConfig.setup(c => c.inspect<boolean>('jediEnabled'))
                .returns(() => undefined as any)
                .verifiable(TypeMoq.Times.once());

            const activationService = new LanguageServerExtensionActivationService(serviceContainer.object, stateFactory.object, experiments.object);
            const result = activationService.isJediUsingDefaultConfiguration(Uri.parse('a'));
            expect(result).to.equal(false, 'Return value should be false');

            workspaceService.verifyAll();
            workspaceConfig.verifyAll();
        });
    });
});
