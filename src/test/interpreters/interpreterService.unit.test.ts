// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { EventEmitter } from 'events';
import { Container } from 'inversify';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Disposable, TextDocument, TextEditor, Uri, WorkspaceConfiguration } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { getArchitectureDisplayName } from '../../client/common/platform/registry';
import { IFileSystem } from '../../client/common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../client/common/process/types';
import { IConfigurationService, IDisposableRegistry, IPersistentStateFactory } from '../../client/common/types';
import * as EnumEx from '../../client/common/utils/enum';
import { noop } from '../../client/common/utils/misc';
import { Architecture } from '../../client/common/utils/platform';
import { IPythonPathUpdaterServiceManager } from '../../client/interpreter/configuration/types';
import {
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterLocatorService,
    INTERPRETER_LOCATOR_SERVICE,
    InterpreterType,
    PIPENV_SERVICE,
    PythonInterpreter,
    WORKSPACE_VIRTUAL_ENV_SERVICE,
    WorkspacePythonPath
} from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';

use(chaiAsPromised);

const info: PythonInterpreter = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    type: InterpreterType.Unknown,
    version: '',
    version_info: [0, 0, 0, 'alpha'],
    sysPrefix: '',
    sysVersion: ''
};

suite('Interpreters service', () => {
    let serviceManager: ServiceManager;
    let serviceContainer: ServiceContainer;
    let updater: TypeMoq.IMock<IPythonPathUpdaterServiceManager>;
    let helper: TypeMoq.IMock<IInterpreterHelper>;
    let locator: TypeMoq.IMock<IInterpreterLocatorService>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let config: TypeMoq.IMock<WorkspaceConfiguration>;
    let pipenvLocator: TypeMoq.IMock<IInterpreterLocatorService>;
    let wksLocator: TypeMoq.IMock<IInterpreterLocatorService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let interpreterDisplay: TypeMoq.IMock<IInterpreterDisplay>;
    let workspacePythonPath: TypeMoq.IMock<WorkspacePythonPath>;
    let virtualEnvMgr: TypeMoq.IMock<IVirtualEnvironmentManager>;
    let persistentStateFactory: TypeMoq.IMock<IPersistentStateFactory>;
    let pythonExecutionFactory: TypeMoq.IMock<IPythonExecutionFactory>;
    let pythonExecutionService: TypeMoq.IMock<IPythonExecutionService>;
    type ConfigValue<T> = { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T; workspaceFolderValue?: T };

    function setupSuite() {
        const cont = new Container();
        serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        updater = TypeMoq.Mock.ofType<IPythonPathUpdaterServiceManager>();
        helper = TypeMoq.Mock.ofType<IInterpreterHelper>();
        locator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        interpreterDisplay = TypeMoq.Mock.ofType<IInterpreterDisplay>();
        workspacePythonPath = TypeMoq.Mock.ofType<WorkspacePythonPath>();
        virtualEnvMgr = TypeMoq.Mock.ofType<IVirtualEnvironmentManager>();
        persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        pythonExecutionFactory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();
        pythonExecutionService = TypeMoq.Mock.ofType<IPythonExecutionService>();

        pythonExecutionService.setup((p: any) => p.then).returns(() => undefined);
        workspace.setup(x => x.getConfiguration('python', TypeMoq.It.isAny())).returns(() => config.object);
        pythonExecutionFactory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(pythonExecutionService.object));
        fileSystem.setup(fs => fs.getFileHash(TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => {
                const state = {
                    updateValue: () => Promise.resolve()
                };
                return state as any;
            });

        serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, []);
        serviceManager.addSingletonInstance<IInterpreterHelper>(IInterpreterHelper, helper.object);
        serviceManager.addSingletonInstance<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager, updater.object);
        serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspace.object);
        serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, locator.object, INTERPRETER_LOCATOR_SERVICE);
        serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, fileSystem.object);
        serviceManager.addSingletonInstance<IInterpreterDisplay>(IInterpreterDisplay, interpreterDisplay.object);
        serviceManager.addSingletonInstance<IVirtualEnvironmentManager>(IVirtualEnvironmentManager, virtualEnvMgr.object);
        serviceManager.addSingletonInstance<IPersistentStateFactory>(IPersistentStateFactory, persistentStateFactory.object);
        serviceManager.addSingletonInstance<IPythonExecutionFactory>(IPythonExecutionFactory, pythonExecutionFactory.object);
        serviceManager.addSingletonInstance<IPythonExecutionService>(IPythonExecutionService, pythonExecutionService.object);

        pipenvLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        wksLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();

    }
    suite('Misc', () => {
        setup(setupSuite);
        [undefined, Uri.file('xyz')]
            .forEach(resource => {
                const resourceTestSuffix = `(${resource ? 'with' : 'without'} a resource)`;

                test(`Refresh invokes refresh of display ${resourceTestSuffix}`, async () => {
                    interpreterDisplay
                        .setup(i => i.refresh(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve(undefined))
                        .verifiable(TypeMoq.Times.once());

                    const service = new InterpreterService(serviceContainer);
                    await service.refresh(resource);

                    interpreterDisplay.verifyAll();
                });

                test(`get Interpreters uses interpreter locactors to get interpreters ${resourceTestSuffix}`, async () => {
                    locator
                        .setup(l => l.getInterpreters(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve([]))
                        .verifiable(TypeMoq.Times.once());

                    const service = new InterpreterService(serviceContainer);
                    await service.getInterpreters(resource);

                    locator.verifyAll();
                });
            });

        test('Changes to active document should invoke intrepreter.refresh method', async () => {
            const service = new InterpreterService(serviceContainer);
            const configService = TypeMoq.Mock.ofType<IConfigurationService>();
            const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();

            let activeTextEditorChangeHandler: Function | undefined;
            documentManager.setup(d => d.onDidChangeActiveTextEditor(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(handler => {
                activeTextEditorChangeHandler = handler;
                return { dispose: noop };
            });
            serviceManager.addSingletonInstance(IConfigurationService, configService.object);
            serviceManager.addSingletonInstance(IDocumentManager, documentManager.object);

            // tslint:disable-next-line:no-any
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => new EventEmitter() as any);
            service.initialize();
            const textEditor = TypeMoq.Mock.ofType<TextEditor>();
            const uri = Uri.file(path.join('usr', 'file.py'));
            const document = TypeMoq.Mock.ofType<TextDocument>();
            textEditor.setup(t => t.document).returns(() => document.object);
            document.setup(d => d.uri).returns(() => uri);
            activeTextEditorChangeHandler!(textEditor.object);

            interpreterDisplay.verify(i => i.refresh(TypeMoq.It.isValue(uri)), TypeMoq.Times.once());
        });

        test('If there is no active document then intrepreter.refresh should not be invoked', async () => {
            const service = new InterpreterService(serviceContainer);
            const configService = TypeMoq.Mock.ofType<IConfigurationService>();
            const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();

            let activeTextEditorChangeHandler: Function | undefined;
            documentManager.setup(d => d.onDidChangeActiveTextEditor(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(handler => {
                activeTextEditorChangeHandler = handler;
                return { dispose: noop };
            });
            serviceManager.addSingletonInstance(IConfigurationService, configService.object);
            serviceManager.addSingletonInstance(IDocumentManager, documentManager.object);

            // tslint:disable-next-line:no-any
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => new EventEmitter() as any);
            service.initialize();
            activeTextEditorChangeHandler!();

            interpreterDisplay.verify(i => i.refresh(TypeMoq.It.isValue(undefined)), TypeMoq.Times.never());
        });

    });

    suite('Get Interpreter Details', () => {
        setup(setupSuite);
        [undefined, Uri.file('some workspace')]
            .forEach(resource => {
                test(`Ensure undefined is returned if we're unable to retrieve interpreter info (Resource is ${resource})`, async () => {
                    const pythonPath = 'SOME VALUE';
                    const service = new InterpreterService(serviceContainer);
                    locator
                        .setup(l => l.getInterpreters(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve([]))
                        .verifiable(TypeMoq.Times.once());
                    helper
                        .setup(h => h.getInterpreterInformation(TypeMoq.It.isValue(pythonPath)))
                        .returns(() => Promise.resolve(undefined))
                        .verifiable(TypeMoq.Times.once());
                    virtualEnvMgr
                        .setup(v => v.getEnvironmentName(TypeMoq.It.isValue(pythonPath)))
                        .returns(() => Promise.resolve(''))
                        .verifiable(TypeMoq.Times.once());
                    virtualEnvMgr
                        .setup(v => v.getEnvironmentType(TypeMoq.It.isValue(pythonPath)))
                        .returns(() => Promise.resolve(InterpreterType.Unknown))
                        .verifiable(TypeMoq.Times.once());
                    pythonExecutionService
                        .setup(p => p.getExecutablePath())
                        .returns(() => Promise.resolve(pythonPath))
                        .verifiable(TypeMoq.Times.once());

                    const details = await service.getInterpreterDetails(pythonPath, resource);

                    locator.verifyAll();
                    pythonExecutionService.verifyAll();
                    helper.verifyAll();
                    expect(details).to.be.equal(undefined, 'Not undefined');
                });
            });
    });

    suite('Should Auto Set Interpreter', () => {
        setup(setupSuite);
        test('Should not auto set interpreter if there is no workspace', async () => {
            const service = new InterpreterService(serviceContainer);
            helper
                .setup(h => h.getActiveWorkspaceUri())
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());

            await expect(service.shouldAutoSetInterpreter()).to.eventually.equal(false, 'not false');

            helper.verifyAll();
        });

        test('Should not auto set interpreter if there is a value in global user settings (global value is not \'python\')', async () => {
            const service = new InterpreterService(serviceContainer);
            workspacePythonPath
                .setup(w => w.folderUri)
                .returns(() => Uri.file('w'))
                .verifiable(TypeMoq.Times.once());
            helper
                .setup(h => h.getActiveWorkspaceUri())
                .returns(() => workspacePythonPath.object)
                .verifiable(TypeMoq.Times.once());
            const pythonPathConfigValue = TypeMoq.Mock.ofType<ConfigValue<string>>();
            config
                .setup(w => w.inspect<string>(TypeMoq.It.isAny()))
                .returns(() => pythonPathConfigValue.object)
                .verifiable(TypeMoq.Times.once());
            pythonPathConfigValue
                .setup(p => p.globalValue)
                .returns(() => path.join('a', 'bin', 'python'))
                .verifiable(TypeMoq.Times.atLeastOnce());

            await expect(service.shouldAutoSetInterpreter()).to.eventually.equal(false, 'not false');

            helper.verifyAll();
            workspace.verifyAll();
            config.verifyAll();
            pythonPathConfigValue.verifyAll();
        });
        test('Should not auto set interpreter if there is a value in workspace settings (& value is not \'python\')', async () => {
            const service = new InterpreterService(serviceContainer);
            workspacePythonPath
                .setup(w => w.configTarget)
                .returns(() => ConfigurationTarget.Workspace)
                .verifiable(TypeMoq.Times.once());
            helper
                .setup(h => h.getActiveWorkspaceUri())
                .returns(() => workspacePythonPath.object)
                .verifiable(TypeMoq.Times.once());
            const pythonPathConfigValue = TypeMoq.Mock.ofType<ConfigValue<string>>();
            config
                .setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
                .returns(() => pythonPathConfigValue.object)
                .verifiable(TypeMoq.Times.once());
            pythonPathConfigValue
                .setup(p => p.globalValue)
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.atLeastOnce());
            pythonPathConfigValue
                .setup(p => p.workspaceValue)
                .returns(() => path.join('a', 'bin', 'python'))
                .verifiable(TypeMoq.Times.atLeastOnce());

            await expect(service.shouldAutoSetInterpreter()).to.eventually.equal(false, 'not false');

            helper.verifyAll();
            workspace.verifyAll();
            config.verifyAll();
            pythonPathConfigValue.verifyAll();
        });

        [
            { configTarget: ConfigurationTarget.Workspace, label: 'Workspace' },
            { configTarget: ConfigurationTarget.WorkspaceFolder, label: 'Workspace Folder' }
        ].forEach(item => {
            const testSuffix = `(${item.label})`;
            const cfgTarget = item.configTarget as (ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder);
            test(`Should auto set interpreter if there is no value in workspace settings ${testSuffix}`, async () => {
                const service = new InterpreterService(serviceContainer);
                workspacePythonPath
                    .setup(w => w.configTarget)
                    .returns(() => cfgTarget)
                    .verifiable(TypeMoq.Times.once());
                helper
                    .setup(h => h.getActiveWorkspaceUri())
                    .returns(() => workspacePythonPath.object)
                    .verifiable(TypeMoq.Times.once());
                const pythonPathConfigValue = TypeMoq.Mock.ofType<ConfigValue<string>>();
                config
                    .setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
                    .returns(() => pythonPathConfigValue.object)
                    .verifiable(TypeMoq.Times.once());
                pythonPathConfigValue
                    .setup(p => p.globalValue)
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                if (cfgTarget === ConfigurationTarget.Workspace) {
                    pythonPathConfigValue
                        .setup(p => p.workspaceValue)
                        .returns(() => undefined)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                } else {
                    pythonPathConfigValue
                        .setup(p => p.workspaceFolderValue)
                        .returns(() => undefined)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                }

                await expect(service.shouldAutoSetInterpreter()).to.eventually.equal(true, 'not true');

                helper.verifyAll();
                workspace.verifyAll();
                config.verifyAll();
                pythonPathConfigValue.verifyAll();
            });

            test(`Should auto set interpreter if there is no value in workspace settings and value is \'python\' ${testSuffix}`, async () => {
                const service = new InterpreterService(serviceContainer);
                workspacePythonPath
                    .setup(w => w.configTarget)
                    .returns(() => ConfigurationTarget.Workspace)
                    .verifiable(TypeMoq.Times.once());
                helper
                    .setup(h => h.getActiveWorkspaceUri())
                    .returns(() => workspacePythonPath.object)
                    .verifiable(TypeMoq.Times.once());
                const pythonPathConfigValue = TypeMoq.Mock.ofType<ConfigValue<string>>();
                config
                    .setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
                    .returns(() => pythonPathConfigValue.object)
                    .verifiable(TypeMoq.Times.once());
                pythonPathConfigValue
                    .setup(p => p.globalValue)
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                pythonPathConfigValue
                    .setup(p => p.workspaceValue)
                    .returns(() => 'python')
                    .verifiable(TypeMoq.Times.atLeastOnce());

                await expect(service.shouldAutoSetInterpreter()).to.eventually.equal(true, 'not true');

                helper.verifyAll();
                workspace.verifyAll();
                config.verifyAll();
                pythonPathConfigValue.verifyAll();
            });
        });
    });

    suite('Auto Set Interpreter', () => {
        setup(setupSuite);
        test('autoset interpreter - no workspace', async () => {
            await verifyUpdateCalled(TypeMoq.Times.never());
        });

        test('autoset interpreter - global pythonPath in config', async () => {
            setupWorkspace('folder');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python', globalValue: 'global' };
            });
            await verifyUpdateCalled(TypeMoq.Times.never());
        });

        test('autoset interpreter - workspace has no pythonPath in config', async () => {
            setupWorkspace('folder');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python' };
            });
            const interpreter: PythonInterpreter = {
                ...info,
                path: path.join('folder', 'py1', 'bin', 'python.exe'),
                type: InterpreterType.Unknown
            };
            setupLocators([interpreter], []);
            await verifyUpdateCalled(TypeMoq.Times.once());
        });

        test('autoset interpreter - workspace has default pythonPath in config', async () => {
            setupWorkspace('folder');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python', workspaceValue: 'python' };
            });
            setupLocators([], []);
            await verifyUpdateCalled(TypeMoq.Times.never());
        });

        test('autoset interpreter - pipenv workspace', async () => {
            setupWorkspace('folder');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python', workspaceValue: 'python' };
            });
            const interpreter: PythonInterpreter = {
                ...info,
                path: 'python',
                type: InterpreterType.VirtualEnv
            };
            setupLocators([], [interpreter]);
            await verifyUpdateCallData('python', ConfigurationTarget.Workspace, 'folder');
        });

        test('autoset interpreter - workspace without interpreter', async () => {
            setupWorkspace('root');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python', workspaceValue: 'elsewhere' };
            });
            const interpreter: PythonInterpreter = {
                ...info,
                path: 'elsewhere',
                type: InterpreterType.Unknown
            };

            setupLocators([interpreter], []);
            await verifyUpdateCalled(TypeMoq.Times.never());
        });

        test('autoset interpreter - workspace with interpreter', async () => {
            setupWorkspace('root');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python' };
            });
            const intPath = path.join('root', 'under', 'bin', 'python.exe');
            const interpreter: PythonInterpreter = {
                ...info,
                path: intPath,
                type: InterpreterType.Unknown
            };

            setupLocators([interpreter], []);
            await verifyUpdateCallData(intPath, ConfigurationTarget.Workspace, 'root');
        });

        async function verifyUpdateCalled(times: TypeMoq.Times) {
            const service = new InterpreterService(serviceContainer);
            await service.autoSetInterpreter();
            updater
                .verify(x => x.updatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), times);
        }

        async function verifyUpdateCallData(pythonPath: string, target: ConfigurationTarget, wksFolder: string) {
            let pp: string | undefined;
            let confTarget: ConfigurationTarget | undefined;
            let trigger;
            let wks;
            updater
                .setup(x => x.updatePythonPath(TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                // tslint:disable-next-line:no-any
                .callback((p: string, c: ConfigurationTarget, t: any, w: any) => {
                    pp = p;
                    confTarget = c;
                    trigger = t;
                    wks = w;
                })
                .returns(() => Promise.resolve());

            const service = new InterpreterService(serviceContainer);
            await service.autoSetInterpreter();

            expect(pp).not.to.be.equal(undefined, 'updatePythonPath not called');
            expect(pp!).to.be.equal(pythonPath, 'invalid Python path');
            expect(confTarget).to.be.equal(target, 'invalid configuration target');
            expect(trigger).to.be.equal('load', 'invalid trigger');
            expect(wks.fsPath).to.be.equal(Uri.file(wksFolder).fsPath, 'invalid workspace Uri');
        }

        function setupWorkspace(folder: string) {
            const wsPath: WorkspacePythonPath = {
                folderUri: Uri.file(folder),
                configTarget: ConfigurationTarget.Workspace
            };
            helper.setup(x => x.getActiveWorkspaceUri()).returns(() => wsPath);
        }

        function setupLocators(wks: PythonInterpreter[], pipenv: PythonInterpreter[]) {
            pipenvLocator.setup(x => x.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(pipenv));
            serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, pipenvLocator.object, PIPENV_SERVICE);
            wksLocator.setup(x => x.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(wks));
            serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, wksLocator.object, WORKSPACE_VIRTUAL_ENV_SERVICE);

        }
    });

    // This is kind of a verbose test, but we need to ensure we have covered all permutations.
    // Also we have special handling for certain types of interpreters.
    suite('Display Format (with all permutations)', () => {
        setup(setupSuite);
        [undefined, Uri.file('xyz')].forEach(resource => {
            [undefined, [1, 2, 3, 'alpha']].forEach(versionInfo => {
                // Forced cast to ignore TS warnings.
                (EnumEx.getNamesAndValues<Architecture>(Architecture) as ({ name: string; value: Architecture } | undefined)[]).concat(undefined).forEach(arch => {
                    [undefined, path.join('a', 'b', 'c', 'd', 'bin', 'python')].forEach(pythonPath => {
                        // Forced cast to ignore TS warnings.
                        (EnumEx.getNamesAndValues<InterpreterType>(InterpreterType) as ({ name: string; value: InterpreterType } | undefined)[]).concat(undefined).forEach(interpreterType => {
                            [undefined, 'my env name'].forEach(envName => {
                                ['', 'my pipenv name'].forEach(pipEnvName => {
                                    const testName = [`${resource ? 'With' : 'Without'} a workspace`,
                                    `${versionInfo ? 'with' : 'without'} version information`,
                                    `${arch ? arch.name : 'without'} architecture`,
                                    `${pythonPath ? 'with' : 'without'} python Path`,
                                    `${interpreterType ? `${interpreterType.name} interpreter type` : 'without interpreter type'}`,
                                    `${envName ? 'with' : 'without'} environment name`,
                                    `${pipEnvName ? 'with' : 'without'} pip environment`
                                    ].join(', ');

                                    test(testName, async () => {
                                        const interpreterInfo: Partial<PythonInterpreter> = {
                                            version_info: versionInfo as any,
                                            architecture: arch ? arch.value : undefined,
                                            envName,
                                            type: interpreterType ? interpreterType.value : undefined,
                                            path: pythonPath
                                        };

                                        if (interpreterInfo.path && interpreterType && interpreterType.value === InterpreterType.PipEnv) {
                                            virtualEnvMgr
                                                .setup(v => v.getEnvironmentName(TypeMoq.It.isValue(interpreterInfo.path!), TypeMoq.It.isAny()))
                                                .returns(() => Promise.resolve(pipEnvName));
                                        }
                                        if (interpreterType) {
                                            helper
                                                .setup(h => h.getInterpreterTypeDisplayName(TypeMoq.It.isValue(interpreterType.value)))
                                                .returns(() => `${interpreterType!.name}_display`);
                                        }

                                        const service = new InterpreterService(serviceContainer);
                                        const expectedDisplayName = buildDisplayName(interpreterInfo);

                                        const displayName = await service.getDisplayName(interpreterInfo, resource);
                                        expect(displayName).to.equal(expectedDisplayName);
                                    });

                                    function buildDisplayName(interpreterInfo: Partial<PythonInterpreter>) {
                                        const displayNameParts: string[] = ['Python'];
                                        const envSuffixParts: string[] = [];

                                        if (interpreterInfo.version_info && interpreterInfo.version_info.length > 0) {
                                            displayNameParts.push(interpreterInfo.version_info.slice(0, 3).join('.'));
                                        }
                                        if (interpreterInfo.architecture) {
                                            displayNameParts.push(getArchitectureDisplayName(interpreterInfo.architecture));
                                        }
                                        if (!interpreterInfo.envName && interpreterInfo.path && interpreterInfo.type && interpreterInfo.type === InterpreterType.PipEnv && pipEnvName) {
                                            // If we do not have the name of the environment, then try to get it again.
                                            // This can happen based on the context (i.e. resource).
                                            // I.e. we can determine if an environment is PipEnv only when giving it the right workspacec path (i.e. resource).
                                            interpreterInfo.envName = pipEnvName;
                                        }
                                        if (interpreterInfo.envName && interpreterInfo.envName.length > 0) {
                                            envSuffixParts.push(`'${interpreterInfo.envName}'`);
                                        }
                                        if (interpreterInfo.type) {
                                            envSuffixParts.push(`${interpreterType!.name}_display`);
                                        }

                                        const envSuffix = envSuffixParts.length === 0 ? '' :
                                            `(${envSuffixParts.join(': ')})`;
                                        return `${displayNameParts.join(' ')} ${envSuffix}`.trim();
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
