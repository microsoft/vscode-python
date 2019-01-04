// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { ConfigurationChangeEvent, Disposable } from 'vscode';
import { ExtensionActivationService, LSNotSupportedDiagnosticService } from '../../client/activation/activationService';
import {
    ExtensionActivators, FolderVersionPair,
    IExtensionActivationService, IExtensionActivator,
    ILanguageServerCompatibilityService,
    ILanguageServerFolderService
} from '../../client/activation/types';
import { CommandOption, IDiagnosticsCommandFactory } from '../../client/application/diagnostics/commands/types';
import { DiagnosticCodes } from '../../client/application/diagnostics/constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../../client/application/diagnostics/promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticCommand, IDiagnosticFilterService, IDiagnosticHandlerService, IDiagnosticsService } from '../../client/application/diagnostics/types';
import {
    IApplicationShell, ICommandManager,
    IWorkspaceService
} from '../../client/common/application/types';
import { IPlatformService } from '../../client/common/platform/types';
import {
    IConfigurationService, IDisposableRegistry,
    IOutputChannel, IPythonSettings
} from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';

suite('Activation - ActivationService', () => {
    [true, false].forEach(jediIsEnabled => {
        suite(`Jedi is ${jediIsEnabled ? 'enabled' : 'disabled'}`, () => {
            let diagnosticService: IDiagnosticsService;
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let pythonSettings: TypeMoq.IMock<IPythonSettings>;
            let appShell: TypeMoq.IMock<IApplicationShell>;
            let cmdManager: TypeMoq.IMock<ICommandManager>;
            let workspaceService: TypeMoq.IMock<IWorkspaceService>;
            let platformService: TypeMoq.IMock<IPlatformService>;
            let lanagueServerSupportedService: TypeMoq.IMock<ILanguageServerCompatibilityService>;
            let filterService: TypeMoq.IMock<IDiagnosticFilterService>;
            let commandFactory: TypeMoq.IMock<IDiagnosticsCommandFactory>;
            let messageHandler: TypeMoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
            setup(() => {
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
                lanagueServerSupportedService = TypeMoq.Mock.ofType<ILanguageServerCompatibilityService>();
                filterService = TypeMoq.Mock.ofType<IDiagnosticFilterService>();
                commandFactory = TypeMoq.Mock.ofType<IDiagnosticsCommandFactory>();
                messageHandler = TypeMoq.Mock.ofType<IDiagnosticHandlerService<MessageCommandPrompt>>();
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
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(IDiagnosticFilterService))).returns(() => filterService.object);
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(IDiagnosticsCommandFactory))).returns(() => commandFactory.object);
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(IDiagnosticHandlerService), TypeMoq.It.isValue(DiagnosticCommandPromptHandlerServiceId))).returns(() => messageHandler.object);

                diagnosticService = new LSNotSupportedDiagnosticService(serviceContainer.object);
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

            test('LS is supported', async () => {
                lanagueServerSupportedService.setup(ls => ls.isSupported()).returns(() => Promise.resolve(true));
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object, lanagueServerSupportedService.object);

                await testActivation(activationService, activator, true);
            });
            test('LS is not supported - Test Activation', async () => {
                lanagueServerSupportedService.setup(ls => ls.isSupported()).returns(() => Promise.resolve(false));
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object, lanagueServerSupportedService.object);

                await testActivation(activationService, activator, false);
            });

            if (!jediIsEnabled){
                test('LS is not supported - Should display two options in message displayed with 2 commands', async () => {
                    lanagueServerSupportedService.setup(ls => ls.isSupported()).returns(() => Promise.resolve(false));
                    pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                    let options: MessageCommandPrompt | undefined;
                    const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
                    diagnostic.setup(d => d.code)
                        .returns(() => DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                    const launchBrowserCommand = TypeMoq.Mock.ofType<IDiagnosticCommand>();
                    commandFactory.setup(f => f.createCommand(TypeMoq.It.isAny(),
                        TypeMoq.It.isObjectWith<CommandOption<'launch', string>>({ type: 'launch' })))
                        .returns(() => launchBrowserCommand.object)
                        .verifiable(TypeMoq.Times.once());
                    const alwaysIgnoreCommand = TypeMoq.Mock.ofType<IDiagnosticCommand>();
                    commandFactory.setup(f => f.createCommand(TypeMoq.It.isAny(),
                        TypeMoq.It.isObjectWith<CommandOption<'ignore', DiagnosticScope>>({ type: 'ignore', options: DiagnosticScope.Global })))
                        .returns(() => alwaysIgnoreCommand.object)
                        .verifiable(TypeMoq.Times.once());
                    messageHandler.setup(m => m.handle(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                        .callback((_, opts: MessageCommandPrompt) => options = opts)
                        .verifiable(TypeMoq.Times.once());

                    await diagnosticService.handle([diagnostic.object]);

                    diagnostic.verifyAll();
                    commandFactory.verifyAll();
                    messageHandler.verifyAll();
                    expect(options!.commandPrompts).to.be.lengthOf(2);
                    expect(options!.commandPrompts[0].prompt).to.be.equal('More Info');
                });
                test('LS is not supported - Should not display a message if the diagnostic code has been ignored', async () => {
                    const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();

                    filterService.setup(f => f.shouldIgnoreDiagnostic(TypeMoq.It.isValue(DiagnosticCodes.LSNotSupportedDiagnostic)))
                        .returns(() => Promise.resolve(true))
                        .verifiable(TypeMoq.Times.once());
                    diagnostic.setup(d => d.code)
                        .returns(() => DiagnosticCodes.LSNotSupportedDiagnostic)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                    commandFactory.setup(f => f.createCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                        .verifiable(TypeMoq.Times.never());
                    messageHandler.setup(m => m.handle(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                        .verifiable(TypeMoq.Times.never());

                    await diagnosticService.handle([diagnostic.object]);

                    filterService.verifyAll();
                    diagnostic.verifyAll();
                    commandFactory.verifyAll();
                    messageHandler.verifyAll();
                });
            }

            test('LSNotSupportedDiagnosticService can handle LSNotSupported diagnostics', async () => {
                const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
                diagnostic.setup(d => d.code)
                    .returns(() => DiagnosticCodes.LSNotSupportedDiagnostic)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                const canHandle = await diagnosticService.canHandle(diagnostic.object);
                expect(canHandle).to.be.equal(true, 'Invalid value');
                diagnostic.verifyAll();
            });
            test('LSNotSupportedDiagnosticService can not handle non-LSNotSupported diagnostics', async () => {
                const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
                diagnostic.setup(d => d.code)
                    .returns(() => 'Something Else')
                    .verifiable(TypeMoq.Times.atLeastOnce());
                const canHandle = await diagnosticService.canHandle(diagnostic.object);
                expect(canHandle).to.be.equal(false, 'Invalid value');
                diagnostic.verifyAll();
            });

            test('Activatory must be activated', async () => {
                lanagueServerSupportedService.setup(ls => ls.isSupported()).returns(() => Promise.resolve(true));
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object, lanagueServerSupportedService.object);

                await testActivation(activationService, activator);
            });
            test('Activatory must be deactivated', async () => {
                lanagueServerSupportedService.setup(ls => ls.isSupported()).returns(() => Promise.resolve(true));
                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object, lanagueServerSupportedService.object);

                await testActivation(activationService, activator);

                activator
                    .setup(a => a.deactivate()).returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.once());

                activationService.dispose();
                activator.verifyAll();
            });
            test('Prompt user to reload VS Code and reload, when setting is toggled', async () => {
                lanagueServerSupportedService.setup(ls => ls.isSupported()).returns(() => Promise.resolve(true));
                let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                let jediIsEnabledValueInSetting = jediIsEnabled;
                workspaceService
                    .setup(w => w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .callback(cb => callbackHandler = cb)
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabledValueInSetting);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object, lanagueServerSupportedService.object);

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
                lanagueServerSupportedService.setup(ls => ls.isSupported()).returns(() => Promise.resolve(true));
                let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                let jediIsEnabledValueInSetting = jediIsEnabled;
                workspaceService
                    .setup(w => w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .callback(cb => callbackHandler = cb)
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabledValueInSetting);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object, lanagueServerSupportedService.object);

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
                lanagueServerSupportedService.setup(ls => ls.isSupported()).returns(() => Promise.resolve(true));
                let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                workspaceService
                    .setup(w => w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .callback(cb => callbackHandler = cb)
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object, lanagueServerSupportedService.object);

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
                lanagueServerSupportedService.setup(ls => ls.isSupported()).returns(() => Promise.resolve(true));
                let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                workspaceService
                    .setup(w => w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .callback(cb => callbackHandler = cb)
                    .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                    .verifiable(TypeMoq.Times.once());

                pythonSettings.setup(p => p.jediEnabled).returns(() => jediIsEnabled);
                const activator = TypeMoq.Mock.ofType<IExtensionActivator>();
                const activationService = new ExtensionActivationService(serviceContainer.object, lanagueServerSupportedService.object);

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
