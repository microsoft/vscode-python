// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { ConfigurationChangeEvent, Disposable, EventEmitter, Uri, WorkspaceConfiguration } from 'vscode';

import { LanguageServerExtensionActivationService } from '../../client/activation/activationService';
import {
    FolderVersionPair,
    IExtensionActivationService,
    ILanguageServerActivator,
    ILanguageServerFolderService,
    LanguageServerType,
} from '../../client/activation/types';
import { IDiagnostic, IDiagnosticsService } from '../../client/application/diagnostics/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../client/common/application/types';
import { PythonSettings } from '../../client/common/configSettings';
import { IPlatformService } from '../../client/common/platform/types';
import {
    IConfigurationService,
    IDisposable,
    IDisposableRegistry,
    IExtensions,
    IOutputChannel,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings,
    Resource,
} from '../../client/common/types';
import { LanguageService } from '../../client/common/utils/localize';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { IServiceContainer } from '../../client/ioc/types';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';

suite('Language Server Activation - ActivationService', () => {
    [LanguageServerType.Jedi].forEach((languageServerType) => {
        suite(
            `Test activation - ${
                languageServerType === LanguageServerType.Jedi ? 'Jedi is enabled' : 'Jedi is disabled'
            }`,
            () => {
                let serviceContainer: TypeMoq.IMock<IServiceContainer>;
                let pythonSettings: TypeMoq.IMock<IPythonSettings>;
                let appShell: TypeMoq.IMock<IApplicationShell>;
                let cmdManager: TypeMoq.IMock<ICommandManager>;
                let workspaceService: TypeMoq.IMock<IWorkspaceService>;
                let platformService: TypeMoq.IMock<IPlatformService>;
                let lsNotSupportedDiagnosticService: TypeMoq.IMock<IDiagnosticsService>;
                let stateFactory: TypeMoq.IMock<IPersistentStateFactory>;
                let state: TypeMoq.IMock<IPersistentState<boolean | undefined>>;
                let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;
                let interpreterService: TypeMoq.IMock<IInterpreterService>;
                let output: TypeMoq.IMock<IOutputChannel>;

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
                    const extensionsMock = TypeMoq.Mock.ofType<IExtensions>();
                    const folderVer: FolderVersionPair = {
                        path: '',
                        version: new SemVer('1.2.3'),
                    };
                    lsNotSupportedDiagnosticService = TypeMoq.Mock.ofType<IDiagnosticsService>();

                    workspaceService.setup((w) => w.hasWorkspaceFolders).returns(() => false);
                    workspaceService.setup((w) => w.workspaceFolders).returns(() => []);
                    configService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
                    interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
                    const disposable = TypeMoq.Mock.ofType<IDisposable>();
                    interpreterService
                        .setup((i) => i.onDidChangeInterpreter(TypeMoq.It.isAny()))
                        .returns(() => disposable.object);
                    langFolderServiceMock
                        .setup((l) => l.getCurrentLanguageServerDirectory())
                        .returns(() => Promise.resolve(folderVer));
                    stateFactory
                        .setup((f) =>
                            f.createGlobalPersistentState(
                                TypeMoq.It.isValue('SWITCH_LS'),
                                TypeMoq.It.isAny(),
                                TypeMoq.It.isAny(),
                            ),
                        )
                        .returns(() => state.object);
                    state.setup((s) => s.value).returns(() => undefined);
                    state.setup((s) => s.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());
                    workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
                    workspaceService
                        .setup((ws) => ws.getConfiguration('python', TypeMoq.It.isAny()))
                        .returns(() => workspaceConfig.object);
                    output = TypeMoq.Mock.ofType<IOutputChannel>();
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny()))
                        .returns(() => output.object);
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService)))
                        .returns(() => workspaceService.object);
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell)))
                        .returns(() => appShell.object);
                    serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService)))
                        .returns(() => configService.object);
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(ICommandManager)))
                        .returns(() => cmdManager.object);
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IPlatformService)))
                        .returns(() => platformService.object);
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService)))
                        .returns(() => interpreterService.object);
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(ILanguageServerFolderService)))
                        .returns(() => langFolderServiceMock.object);
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IExtensions)))
                        .returns(() => extensionsMock.object);
                });

                async function testActivation(
                    activationService: IExtensionActivationService,
                    activator: TypeMoq.IMock<ILanguageServerActivator>,
                    lsSupported: boolean = true,
                    activatorName: LanguageServerType = LanguageServerType.Jedi,
                ) {
                    activator
                        .setup((a) => a.start(undefined, undefined))
                        .returns(() => Promise.resolve())
                        .verifiable(TypeMoq.Times.once());
                    activator.setup((a) => a.activate()).verifiable(TypeMoq.Times.once());

                    if (
                        activatorName !== LanguageServerType.None &&
                        lsSupported &&
                        activatorName !== LanguageServerType.Jedi
                    ) {
                        activatorName = LanguageServerType.Node;
                    }

                    let diagnostics: IDiagnostic[];
                    if (!lsSupported && activatorName !== LanguageServerType.Jedi) {
                        diagnostics = [TypeMoq.It.isAny()];
                    } else {
                        diagnostics = [];
                    }

                    lsNotSupportedDiagnosticService
                        .setup((l) => l.diagnose(undefined))
                        .returns(() => Promise.resolve(diagnostics));
                    lsNotSupportedDiagnosticService
                        .setup((l) => l.handle(TypeMoq.It.isValue(diagnostics)))
                        .returns(() => Promise.resolve());
                    serviceContainer
                        .setup((c) =>
                            c.get(TypeMoq.It.isValue(ILanguageServerActivator), TypeMoq.It.isValue(activatorName)),
                        )
                        .returns(() => activator.object)
                        .verifiable(TypeMoq.Times.once());

                    await activationService.activate(undefined);

                    activator.verifyAll();
                    serviceContainer.verifyAll();
                }

                async function testReloadMessage(settingName: string): Promise<void> {
                    let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                    workspaceService
                        .setup((w) =>
                            w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
                        )
                        .callback((cb) => (callbackHandler = cb))
                        .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                        .verifiable(TypeMoq.Times.once());

                    pythonSettings.setup((p) => p.languageServer).returns(() => languageServerType);
                    const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activationService = new LanguageServerExtensionActivationService(
                        serviceContainer.object,
                        stateFactory.object,
                    );

                    workspaceService.verifyAll();
                    await testActivation(activationService, activator);

                    const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
                    event
                        .setup((e) =>
                            e.affectsConfiguration(TypeMoq.It.isValue(`python.${settingName}`), TypeMoq.It.isAny()),
                        )
                        .returns(() => true)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                    appShell
                        .setup((a) => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isValue('Reload')))
                        .returns(() => Promise.resolve('Reload'))
                        .verifiable(TypeMoq.Times.once());
                    cmdManager
                        .setup((c) => c.executeCommand(TypeMoq.It.isValue('workbench.action.reloadWindow')))
                        .verifiable(TypeMoq.Times.once());

                    // Toggle the value in the setting and invoke the callback.
                    languageServerType =
                        languageServerType === LanguageServerType.Jedi
                            ? LanguageServerType.None
                            : LanguageServerType.Jedi;
                    await callbackHandler(event.object);

                    event.verifyAll();
                    appShell.verifyAll();
                    cmdManager.verifyAll();
                }

                test('LS is supported', async () => {
                    pythonSettings.setup((p) => p.languageServer).returns(() => LanguageServerType.Node);
                    const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activationService = new LanguageServerExtensionActivationService(
                        serviceContainer.object,
                        stateFactory.object,
                    );

                    await testActivation(activationService, activator, true);
                });
                test('LS is not supported', async () => {
                    pythonSettings.setup((p) => p.languageServer).returns(() => LanguageServerType.Node);
                    const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activationService = new LanguageServerExtensionActivationService(
                        serviceContainer.object,
                        stateFactory.object,
                    );

                    await testActivation(activationService, activator, false);
                });

                test('Activator must be activated', async () => {
                    pythonSettings.setup((p) => p.languageServer).returns(() => LanguageServerType.Node);
                    const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activationService = new LanguageServerExtensionActivationService(
                        serviceContainer.object,
                        stateFactory.object,
                    );

                    await testActivation(activationService, activator);
                });
                test('Activator must be deactivated', async () => {
                    pythonSettings.setup((p) => p.languageServer).returns(() => LanguageServerType.Node);
                    const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activationService = new LanguageServerExtensionActivationService(
                        serviceContainer.object,
                        stateFactory.object,
                    );

                    await testActivation(activationService, activator);

                    activator.setup((a) => a.dispose()).verifiable(TypeMoq.Times.once());

                    activationService.dispose();
                    activator.verifyAll();
                });
                test('No language service', async () => {
                    pythonSettings.setup((p) => p.languageServer).returns(() => LanguageServerType.None);
                    const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activationService = new LanguageServerExtensionActivationService(
                        serviceContainer.object,
                        stateFactory.object,
                    );
                    await testActivation(activationService, activator, false, LanguageServerType.None);
                });
                test('Prompt user to reload VS Code and reload, when languageServer setting is toggled', async () => {
                    await testReloadMessage('languageServer');
                });
                test('Do not prompt user to reload VS Code when setting is not changed', async () => {
                    let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
                    workspaceService
                        .setup((w) =>
                            w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
                        )
                        .callback((cb) => (callbackHandler = cb))
                        .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
                        .verifiable(TypeMoq.Times.once());

                    pythonSettings.setup((p) => p.languageServer).returns(() => LanguageServerType.Node);
                    const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                    const activationService = new LanguageServerExtensionActivationService(
                        serviceContainer.object,
                        stateFactory.object,
                    );

                    workspaceService.verifyAll();
                    await testActivation(activationService, activator);

                    const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
                    event
                        .setup((e) =>
                            e.affectsConfiguration(TypeMoq.It.isValue('python.languageServer'), TypeMoq.It.isAny()),
                        )
                        .returns(() => false)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                    appShell
                        .setup((a) => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isValue('Reload')))
                        .returns(() => Promise.resolve(undefined))
                        .verifiable(TypeMoq.Times.never());
                    cmdManager
                        .setup((c) => c.executeCommand(TypeMoq.It.isValue('workbench.action.reloadWindow')))
                        .verifiable(TypeMoq.Times.never());

                    // Invoke the config changed callback.
                    await callbackHandler(event.object);

                    event.verifyAll();
                    appShell.verifyAll();
                    cmdManager.verifyAll();
                });
                if (languageServerType !== LanguageServerType.Jedi) {
                    test('Revert to jedi when LS activation fails', async () => {
                        pythonSettings.setup((p) => p.languageServer).returns(() => LanguageServerType.Node);
                        const activatorLS = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                        const activatorJedi = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                        const activationService = new LanguageServerExtensionActivationService(
                            serviceContainer.object,
                            stateFactory.object,
                        );
                        const diagnostics: IDiagnostic[] = [];
                        lsNotSupportedDiagnosticService
                            .setup((l) => l.diagnose(undefined))
                            .returns(() => Promise.resolve(diagnostics));
                        lsNotSupportedDiagnosticService
                            .setup((l) => l.handle(TypeMoq.It.isValue(diagnostics)))
                            .returns(() => Promise.resolve());
                        serviceContainer
                            .setup((c) =>
                                c.get(
                                    TypeMoq.It.isValue(ILanguageServerActivator),
                                    TypeMoq.It.isValue(LanguageServerType.Node),
                                ),
                            )
                            .returns(() => activatorLS.object)
                            .verifiable(TypeMoq.Times.once());
                        activatorLS
                            .setup((a) => a.start(undefined, undefined))
                            .returns(() => Promise.reject(new Error('')))
                            .verifiable(TypeMoq.Times.once());
                        serviceContainer
                            .setup((c) =>
                                c.get(
                                    TypeMoq.It.isValue(ILanguageServerActivator),
                                    TypeMoq.It.isValue(LanguageServerType.Jedi),
                                ),
                            )
                            .returns(() => activatorJedi.object)
                            .verifiable(TypeMoq.Times.once());
                        activatorJedi
                            .setup((a) => a.start(undefined, undefined))
                            .returns(() => Promise.resolve())
                            .verifiable(TypeMoq.Times.once());
                        activatorJedi
                            .setup((a) => a.activate())
                            .returns(() => Promise.resolve())
                            .verifiable(TypeMoq.Times.once());

                        await activationService.activate(undefined);

                        activatorLS.verifyAll();
                        activatorJedi.verifyAll();
                        serviceContainer.verifyAll();
                    });
                    async function testActivationOfResource(
                        activationService: IExtensionActivationService,
                        activator: TypeMoq.IMock<ILanguageServerActivator>,
                        resource: Resource,
                    ) {
                        activator
                            .setup((a) => a.start(TypeMoq.It.isValue(resource), undefined))
                            .returns(() => Promise.resolve())
                            .verifiable(TypeMoq.Times.once());
                        activator.setup((a) => a.activate()).verifiable(TypeMoq.Times.once());
                        lsNotSupportedDiagnosticService
                            .setup((l) => l.diagnose(undefined))
                            .returns(() => Promise.resolve([]));
                        lsNotSupportedDiagnosticService
                            .setup((l) => l.handle(TypeMoq.It.isValue([])))
                            .returns(() => Promise.resolve());
                        serviceContainer
                            .setup((c) =>
                                c.get(
                                    TypeMoq.It.isValue(ILanguageServerActivator),
                                    TypeMoq.It.isValue(LanguageServerType.Node),
                                ),
                            )
                            .returns(() => activator.object)
                            .verifiable(TypeMoq.Times.atLeastOnce());
                        workspaceService
                            .setup((w) => w.getWorkspaceFolderIdentifier(resource, ''))
                            .returns(() => resource!.fsPath)
                            .verifiable(TypeMoq.Times.atLeastOnce());

                        await activationService.activate(resource);

                        activator.verifyAll();
                        serviceContainer.verifyAll();
                        workspaceService.verifyAll();
                    }
                    test('Activator is disposed if activated workspace is removed and LS is "Pylance"', async () => {
                        pythonSettings.setup((p) => p.languageServer).returns(() => LanguageServerType.Node);
                        let workspaceFoldersChangedHandler!: Function;
                        workspaceService
                            .setup((w) => w.onDidChangeWorkspaceFolders(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                            .callback((cb) => (workspaceFoldersChangedHandler = cb))
                            .returns(() => TypeMoq.Mock.ofType<IDisposable>().object)
                            .verifiable(TypeMoq.Times.once());
                        const activationService = new LanguageServerExtensionActivationService(
                            serviceContainer.object,
                            stateFactory.object,
                        );
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
                        workspaceService.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);
                        workspaceService
                            .setup((w) => w.getWorkspaceFolderIdentifier(folder1.uri, ''))
                            .returns(() => folder1.uri.fsPath)
                            .verifiable(TypeMoq.Times.atLeastOnce());
                        workspaceService
                            .setup((w) => w.getWorkspaceFolderIdentifier(folder2.uri, ''))
                            .returns(() => folder2.uri.fsPath)
                            .verifiable(TypeMoq.Times.atLeastOnce());
                        activator1.setup((d) => d.dispose()).verifiable(TypeMoq.Times.never());
                        activator2.setup((d) => d.dispose()).verifiable(TypeMoq.Times.never());
                        activator3.setup((d) => d.dispose()).verifiable(TypeMoq.Times.once());
                        await workspaceFoldersChangedHandler.call(activationService);
                        workspaceService.verifyAll();
                        activator3.verifyAll();
                    });
                } else {
                    test('Jedi is only started once', async () => {
                        pythonSettings.setup((p) => p.languageServer).returns(() => LanguageServerType.Jedi);
                        const activator1 = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                        const activationService = new LanguageServerExtensionActivationService(
                            serviceContainer.object,
                            stateFactory.object,
                        );
                        const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
                        const folder2 = { name: 'two', uri: Uri.parse('two'), index: 2 };
                        serviceContainer
                            .setup((c) =>
                                c.get(
                                    TypeMoq.It.isValue(ILanguageServerActivator),
                                    TypeMoq.It.isValue(LanguageServerType.Jedi),
                                ),
                            )
                            .returns(() => activator1.object)
                            .verifiable(TypeMoq.Times.once());
                        activator1
                            .setup((a) => a.start(folder1.uri, undefined))
                            .returns(() => Promise.resolve())
                            .verifiable(TypeMoq.Times.once());
                        await activationService.activate(folder1.uri);
                        activator1.verifyAll();
                        activator1.verify((a) => a.activate(), TypeMoq.Times.once());
                        serviceContainer.verifyAll();

                        const activator2 = TypeMoq.Mock.ofType<ILanguageServerActivator>();
                        serviceContainer
                            .setup((c) =>
                                c.get(
                                    TypeMoq.It.isValue(ILanguageServerActivator),
                                    TypeMoq.It.isValue(LanguageServerType.Jedi),
                                ),
                            )
                            .returns(() => activator2.object)
                            .verifiable(TypeMoq.Times.once());
                        activator2
                            .setup((a) => a.start(folder2.uri, undefined))
                            .returns(() => Promise.resolve())
                            .verifiable(TypeMoq.Times.never());
                        activator2.setup((a) => a.activate()).verifiable(TypeMoq.Times.never());
                        await activationService.activate(folder2.uri);
                        serviceContainer.verifyAll();
                        activator1.verifyAll();
                        activator1.verify((a) => a.activate(), TypeMoq.Times.exactly(2));
                        activator2.verifyAll();
                    });
                }
            },
        );
    });

    suite('Test language server swap when using Python 2.7', () => {
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let appShell: TypeMoq.IMock<IApplicationShell>;
        let cmdManager: TypeMoq.IMock<ICommandManager>;
        let workspaceService: TypeMoq.IMock<IWorkspaceService>;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let stateFactory: TypeMoq.IMock<IPersistentStateFactory>;
        let state: TypeMoq.IMock<IPersistentState<boolean | undefined>>;
        let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;
        let interpreterService: TypeMoq.IMock<IInterpreterService>;
        let output: TypeMoq.IMock<IOutputChannel>;
        let configurationService: TypeMoq.IMock<IConfigurationService>;

        setup(() => {
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            cmdManager = TypeMoq.Mock.ofType<ICommandManager>();
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
            stateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
            state = TypeMoq.Mock.ofType<IPersistentState<boolean | undefined>>();
            configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
            const extensionsMock = TypeMoq.Mock.ofType<IExtensions>();

            workspaceService.setup((w) => w.hasWorkspaceFolders).returns(() => false);
            workspaceService.setup((w) => w.workspaceFolders).returns(() => []);
            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            state.setup((s) => s.value).returns(() => undefined);
            state.setup((s) => s.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());
            workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            workspaceService
                .setup((ws) => ws.getConfiguration('python', TypeMoq.It.isAny()))
                .returns(() => workspaceConfig.object);
            output = TypeMoq.Mock.ofType<IOutputChannel>();
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny()))
                .returns(() => output.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService)))
                .returns(() => configurationService.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ICommandManager))).returns(() => cmdManager.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IPlatformService)))
                .returns(() => platformService.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService)))
                .returns(() => interpreterService.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IExtensions))).returns(() => extensionsMock.object);
        });

        const values: { ls: LanguageServerType; expected: LanguageServerType; outputString: string }[] = [
            {
                ls: LanguageServerType.Jedi,
                expected: LanguageServerType.None,
                outputString: LanguageService.startingNone(),
            },
            {
                ls: LanguageServerType.Node,
                expected: LanguageServerType.Node,
                outputString: LanguageService.startingPylance(),
            },
            {
                ls: LanguageServerType.None,
                expected: LanguageServerType.None,
                outputString: LanguageService.startingNone(),
            },
        ];

        const interpreter = {
            version: { major: 2, minor: 7, patch: 10 },
        } as PythonEnvironment;

        values.forEach(({ ls, expected, outputString }) => {
            test(`When language server setting explicitly set to ${ls} and using Python 2.7, use a language server of type ${expected}`, async () => {
                const resource = Uri.parse('one.py');
                const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();

                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(ILanguageServerActivator), expected))
                    .returns(() => activator.object);
                configurationService
                    .setup((c) => c.getSettings(TypeMoq.It.isAny()))
                    .returns(() => ({ languageServer: ls, languageServerIsDefault: false } as PythonSettings));

                const activationService = new LanguageServerExtensionActivationService(
                    serviceContainer.object,
                    stateFactory.object,
                );

                await activationService.get(resource, interpreter);

                output.verify((o) => o.appendLine(outputString), TypeMoq.Times.once());
                activator.verify((a) => a.start(resource, interpreter), TypeMoq.Times.once());
            });
        });

        test('When default language server setting set to true and using Python 2.7, use Pylance', async () => {
            const resource = Uri.parse('one.py');
            const activator = TypeMoq.Mock.ofType<ILanguageServerActivator>();

            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(ILanguageServerActivator), LanguageServerType.Node))
                .returns(() => activator.object);
            configurationService
                .setup((c) => c.getSettings(TypeMoq.It.isAny()))
                .returns(() => ({ languageServerIsDefault: true } as PythonSettings));

            const activationService = new LanguageServerExtensionActivationService(
                serviceContainer.object,
                stateFactory.object,
            );

            await activationService.get(resource, interpreter);

            output.verify((o) => o.appendLine(LanguageService.startingPylance()), TypeMoq.Times.once());
            activator.verify((a) => a.start(resource, interpreter), TypeMoq.Times.once());
        });
    });

    suite('Test sendTelemetryForChosenLanguageServer()', () => {
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let pythonSettings: TypeMoq.IMock<IPythonSettings>;
        let appShell: TypeMoq.IMock<IApplicationShell>;
        let cmdManager: TypeMoq.IMock<ICommandManager>;
        let workspaceService: TypeMoq.IMock<IWorkspaceService>;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let stateFactory: TypeMoq.IMock<IPersistentStateFactory>;
        let state: TypeMoq.IMock<IPersistentState<LanguageServerType | undefined>>;
        let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;
        let interpreterService: TypeMoq.IMock<IInterpreterService>;
        setup(() => {
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            cmdManager = TypeMoq.Mock.ofType<ICommandManager>();
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
            stateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
            state = TypeMoq.Mock.ofType<IPersistentState<LanguageServerType | undefined>>();
            const configService = TypeMoq.Mock.ofType<IConfigurationService>();
            pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            const e = new EventEmitter<void>();
            interpreterService.setup((i) => i.onDidChangeInterpreter).returns(() => e.event);
            const langFolderServiceMock = TypeMoq.Mock.ofType<ILanguageServerFolderService>();
            const extensionsMock = TypeMoq.Mock.ofType<IExtensions>();
            const folderVer: FolderVersionPair = {
                path: '',
                version: new SemVer('1.2.3'),
            };
            workspaceService.setup((w) => w.hasWorkspaceFolders).returns(() => false);
            workspaceService.setup((w) => w.workspaceFolders).returns(() => []);
            configService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
            langFolderServiceMock
                .setup((l) => l.getCurrentLanguageServerDirectory())
                .returns(() => Promise.resolve(folderVer));
            stateFactory
                .setup((f) =>
                    f.createGlobalPersistentState(
                        TypeMoq.It.isValue('SWITCH_LS'),
                        TypeMoq.It.isAny(),
                        TypeMoq.It.isAny(),
                    ),
                )
                .returns(() => state.object);
            state.setup((s) => s.value).returns(() => undefined);
            state.setup((s) => s.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());
            workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            workspaceService
                .setup((ws) => ws.getConfiguration('python', TypeMoq.It.isAny()))
                .returns(() => workspaceConfig.object);
            const output = TypeMoq.Mock.ofType<IOutputChannel>();
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny()))
                .returns(() => output.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService)))
                .returns(() => configService.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ICommandManager))).returns(() => cmdManager.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IPlatformService)))
                .returns(() => platformService.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService)))
                .returns(() => interpreterService.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(ILanguageServerFolderService)))
                .returns(() => langFolderServiceMock.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IExtensions))).returns(() => extensionsMock.object);
        });

        test('Track current LS usage for first usage', async () => {
            state.reset();
            state
                .setup((s) => s.value)
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.exactly(2));
            state
                .setup((s) => s.updateValue(TypeMoq.It.isValue(LanguageServerType.Jedi)))
                .returns(() => {
                    state.setup((s) => s.value).returns(() => LanguageServerType.Jedi);
                    return Promise.resolve();
                })
                .verifiable(TypeMoq.Times.once());

            const activationService = new LanguageServerExtensionActivationService(
                serviceContainer.object,
                stateFactory.object,
            );
            await activationService.sendTelemetryForChosenLanguageServer(LanguageServerType.Jedi);

            state.verifyAll();
        });
        test('Track switch to LS', async () => {
            state.reset();
            state
                .setup((s) => s.value)
                .returns(() => LanguageServerType.Jedi)
                .verifiable(TypeMoq.Times.exactly(2));
            state
                .setup((s) => s.updateValue(TypeMoq.It.isValue(LanguageServerType.Node)))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            const activationService = new LanguageServerExtensionActivationService(
                serviceContainer.object,
                stateFactory.object,
            );
            await activationService.sendTelemetryForChosenLanguageServer(LanguageServerType.Node);

            state.verifyAll();
        });
        test('Track switch to Jedi', async () => {
            state.reset();
            state
                .setup((s) => s.value)
                .returns(() => LanguageServerType.Node)
                .verifiable(TypeMoq.Times.exactly(2));
            state
                .setup((s) => s.updateValue(TypeMoq.It.isValue(LanguageServerType.Jedi)))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            const activationService = new LanguageServerExtensionActivationService(
                serviceContainer.object,
                stateFactory.object,
            );
            await activationService.sendTelemetryForChosenLanguageServer(LanguageServerType.Jedi);

            state.verifyAll();
        });
        test('Track startup value', async () => {
            state.reset();
            state
                .setup((s) => s.value)
                .returns(() => LanguageServerType.Jedi)
                .verifiable(TypeMoq.Times.exactly(2));
            state
                .setup((s) => s.updateValue(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());

            const activationService = new LanguageServerExtensionActivationService(
                serviceContainer.object,
                stateFactory.object,
            );
            await activationService.sendTelemetryForChosenLanguageServer(LanguageServerType.Jedi);

            state.verifyAll();
        });
    });

    suite('Function isJediUsingDefaultConfiguration()', () => {
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let pythonSettings: TypeMoq.IMock<IPythonSettings>;
        let appShell: TypeMoq.IMock<IApplicationShell>;
        let cmdManager: TypeMoq.IMock<ICommandManager>;
        let workspaceService: TypeMoq.IMock<IWorkspaceService>;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let stateFactory: TypeMoq.IMock<IPersistentStateFactory>;
        let state: TypeMoq.IMock<IPersistentState<boolean | undefined>>;
        let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;
        let interpreterService: TypeMoq.IMock<IInterpreterService>;
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
            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            const e = new EventEmitter<void>();
            interpreterService.setup((i) => i.onDidChangeInterpreter).returns(() => e.event);
            const langFolderServiceMock = TypeMoq.Mock.ofType<ILanguageServerFolderService>();
            const extensionsMock = TypeMoq.Mock.ofType<IExtensions>();
            const folderVer: FolderVersionPair = {
                path: '',
                version: new SemVer('1.2.3'),
            };
            workspaceService.setup((w) => w.hasWorkspaceFolders).returns(() => false);
            workspaceService.setup((w) => w.workspaceFolders).returns(() => []);
            configService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
            langFolderServiceMock
                .setup((l) => l.getCurrentLanguageServerDirectory())
                .returns(() => Promise.resolve(folderVer));
            stateFactory
                .setup((f) =>
                    f.createGlobalPersistentState(
                        TypeMoq.It.isValue('SWITCH_LS'),
                        TypeMoq.It.isAny(),
                        TypeMoq.It.isAny(),
                    ),
                )
                .returns(() => state.object);
            state.setup((s) => s.value).returns(() => undefined);
            state.setup((s) => s.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());
            workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            workspaceService
                .setup((ws) => ws.getConfiguration('python', TypeMoq.It.isAny()))
                .returns(() => workspaceConfig.object);
            const output = TypeMoq.Mock.ofType<IOutputChannel>();
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny()))
                .returns(() => output.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService)))
                .returns(() => configService.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ICommandManager))).returns(() => cmdManager.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IPlatformService)))
                .returns(() => platformService.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService)))
                .returns(() => interpreterService.object);
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(ILanguageServerFolderService)))
                .returns(() => langFolderServiceMock.object);
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IExtensions))).returns(() => extensionsMock.object);
        });
        const value = [undefined, true, false]; // Possible values of settings
        const index = [0, 1, 2]; // Index associated with each value
        const expectedResults: boolean[][][] = Array(3) // Initializing a 3D array with default value `false`
            .fill(false)
            .map(() =>
                Array(3)
                    .fill(false)
                    .map(() => Array(3).fill(false)),
            );
        expectedResults[0][0][0] = true;
        for (const globalIndex of index) {
            for (const workspaceIndex of index) {
                for (const workspaceFolderIndex of index) {
                    const expectedResult = expectedResults[globalIndex][workspaceIndex][workspaceFolderIndex];
                    const settings = {
                        globalValue: value[globalIndex],
                        workspaceValue: value[workspaceIndex],
                        workspaceFolderValue: value[workspaceFolderIndex],
                    };
                    const testName = `Returns ${expectedResult} for setting = ${JSON.stringify(settings)}`;
                    test(testName, async () => {
                        workspaceConfig.reset();
                        workspaceConfig
                            .setup((c) => c.inspect<LanguageServerType>('languageServer'))
                            .returns(() => settings as any)
                            .verifiable(TypeMoq.Times.once());

                        const activationService = new LanguageServerExtensionActivationService(
                            serviceContainer.object,
                            stateFactory.object,
                        );
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
            workspaceConfig
                .setup((c) => c.inspect<LanguageServerType>('languageServer'))
                .returns(() => undefined as any)
                .verifiable(TypeMoq.Times.once());

            const activationService = new LanguageServerExtensionActivationService(
                serviceContainer.object,
                stateFactory.object,
            );
            const result = activationService.isJediUsingDefaultConfiguration(Uri.parse('a'));
            expect(result).to.equal(false, 'Return value should be false');

            workspaceService.verifyAll();
            workspaceConfig.verifyAll();
        });
    });
});
