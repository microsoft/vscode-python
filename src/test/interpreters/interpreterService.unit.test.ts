// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as md5 from 'md5';
import * as path from 'path';
import * as sinon from 'sinon';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Disposable, TextDocument, TextEditor, Uri, WorkspaceConfiguration } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { DeprecatePythonPath } from '../../client/common/experiments/groups';
import { getArchitectureDisplayName } from '../../client/common/platform/registry';
import { IFileSystem } from '../../client/common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../client/common/process/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentService,
    IExperimentsManager,
    IInterpreterPathService,
    InterpreterConfigurationScope,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings,
} from '../../client/common/types';
import * as EnumEx from '../../client/common/utils/enum';
import { noop } from '../../client/common/utils/misc';
import { Architecture } from '../../client/common/utils/platform';
import {
    IInterpreterAutoSelectionService,
    IInterpreterAutoSelectionProxyService,
} from '../../client/interpreter/autoSelection/types';
import { IPythonPathUpdaterServiceManager } from '../../client/interpreter/configuration/types';
import {
    IComponentAdapter,
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterLocatorService,
    INTERPRETER_LOCATOR_SERVICE,
} from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import * as hashApi from '../../client/pythonEnvironments/discovery/locators/services/hashProvider';
import { EnvironmentType, PythonEnvironment } from '../../client/pythonEnvironments/info';
import { PYTHON_PATH } from '../common';
import { MockAutoSelectionService } from '../mocks/autoSelector';
import { PythonVersion } from '../../client/pythonEnvironments/info/pythonVersion';

/* eslint-disable @typescript-eslint/no-explicit-any */

use(chaiAsPromised);

suite('Interpreters service', () => {
    let serviceManager: ServiceManager;
    let serviceContainer: ServiceContainer;
    let updater: TypeMoq.IMock<IPythonPathUpdaterServiceManager>;
    let pyenvs: TypeMoq.IMock<IComponentAdapter>;
    let helper: TypeMoq.IMock<IInterpreterHelper>;
    let locator: TypeMoq.IMock<IInterpreterLocatorService>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let config: TypeMoq.IMock<WorkspaceConfiguration>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let interpreterDisplay: TypeMoq.IMock<IInterpreterDisplay>;
    let virtualEnvMgr: TypeMoq.IMock<IVirtualEnvironmentManager>;
    let persistentStateFactory: TypeMoq.IMock<IPersistentStateFactory>;
    let pythonExecutionFactory: TypeMoq.IMock<IPythonExecutionFactory>;
    let pythonExecutionService: TypeMoq.IMock<IPythonExecutionService>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let interpreterPathService: TypeMoq.IMock<IInterpreterPathService>;
    let experimentsManager: TypeMoq.IMock<IExperimentsManager>;
    let experimentService: TypeMoq.IMock<IExperimentService>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;

    function setupSuite() {
        const cont = new Container();
        serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        experimentsManager = TypeMoq.Mock.ofType<IExperimentsManager>();
        experimentService = TypeMoq.Mock.ofType<IExperimentService>();
        interpreterPathService = TypeMoq.Mock.ofType<IInterpreterPathService>();
        updater = TypeMoq.Mock.ofType<IPythonPathUpdaterServiceManager>();
        pyenvs = TypeMoq.Mock.ofType<IComponentAdapter>();
        helper = TypeMoq.Mock.ofType<IInterpreterHelper>();
        locator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        interpreterDisplay = TypeMoq.Mock.ofType<IInterpreterDisplay>();
        virtualEnvMgr = TypeMoq.Mock.ofType<IVirtualEnvironmentManager>();
        persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        pythonExecutionFactory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();
        pythonExecutionService = TypeMoq.Mock.ofType<IPythonExecutionService>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();

        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        pythonSettings.setup((s) => s.pythonPath).returns(() => PYTHON_PATH);
        configService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

        pythonExecutionService.setup((p: any) => p.then).returns(() => undefined);
        workspace.setup((x) => x.getConfiguration('python', TypeMoq.It.isAny())).returns(() => config.object);
        pythonExecutionFactory
            .setup((f) => f.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(pythonExecutionService.object));
        fileSystem.setup((fs) => fs.getFileHash(TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => {
                const state = {
                    updateValue: () => Promise.resolve(),
                };
                return state as any;
            });

        serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, []);
        serviceManager.addSingletonInstance<IInterpreterHelper>(IInterpreterHelper, helper.object);
        serviceManager.addSingletonInstance<IPythonPathUpdaterServiceManager>(
            IPythonPathUpdaterServiceManager,
            updater.object,
        );
        serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspace.object);
        serviceManager.addSingletonInstance<IInterpreterLocatorService>(
            IInterpreterLocatorService,
            locator.object,
            INTERPRETER_LOCATOR_SERVICE,
        );
        serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, fileSystem.object);
        serviceManager.addSingletonInstance<IExperimentsManager>(IExperimentsManager, experimentsManager.object);
        serviceManager.addSingletonInstance<IExperimentService>(IExperimentService, experimentService.object);
        serviceManager.addSingletonInstance<IInterpreterPathService>(
            IInterpreterPathService,
            interpreterPathService.object,
        );
        serviceManager.addSingletonInstance<IInterpreterDisplay>(IInterpreterDisplay, interpreterDisplay.object);
        serviceManager.addSingletonInstance<IVirtualEnvironmentManager>(
            IVirtualEnvironmentManager,
            virtualEnvMgr.object,
        );
        serviceManager.addSingletonInstance<IPersistentStateFactory>(
            IPersistentStateFactory,
            persistentStateFactory.object,
        );
        serviceManager.addSingletonInstance<IPythonExecutionFactory>(
            IPythonExecutionFactory,
            pythonExecutionFactory.object,
        );
        serviceManager.addSingletonInstance<IPythonExecutionService>(
            IPythonExecutionService,
            pythonExecutionService.object,
        );
        serviceManager.addSingleton<IInterpreterAutoSelectionService>(
            IInterpreterAutoSelectionService,
            MockAutoSelectionService,
        );
        serviceManager.addSingleton<IInterpreterAutoSelectionProxyService>(
            IInterpreterAutoSelectionProxyService,
            MockAutoSelectionService,
        );
        serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, configService.object);
    }
    suite('Misc', () => {
        setup(setupSuite);
        [undefined, Uri.file('xyz')].forEach((resource) => {
            const resourceTestSuffix = `(${resource ? 'with' : 'without'} a resource)`;

            test(`Refresh invokes refresh of display ${resourceTestSuffix}`, async () => {
                interpreterDisplay
                    .setup((i) => i.refresh(TypeMoq.It.isValue(resource)))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.once());

                const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
                await service.refresh(resource);

                interpreterDisplay.verifyAll();
            });

            test(`get Interpreters uses interpreter locators to get interpreters ${resourceTestSuffix}`, async () => {
                locator
                    .setup((l) => l.getInterpreters(TypeMoq.It.isValue(resource), TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve([]))
                    .verifiable(TypeMoq.Times.once());

                const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
                await service.getInterpreters(resource);

                locator.verifyAll();
            });
        });

        test('Changes to active document should invoke interpreter.refresh method', async () => {
            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
            const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();

            experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
            experimentsManager
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            workspace.setup((w) => w.hasWorkspaceFolders).returns(() => true);
            workspace.setup((w) => w.workspaceFolders).returns(() => [{ uri: '' }] as any);
            let activeTextEditorChangeHandler: (e: TextEditor | undefined) => any | undefined;
            documentManager
                .setup((d) => d.onDidChangeActiveTextEditor(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns((handler) => {
                    activeTextEditorChangeHandler = handler;
                    return { dispose: noop };
                });
            serviceManager.addSingletonInstance(IDocumentManager, documentManager.object);

            service.initialize();
            const textEditor = TypeMoq.Mock.ofType<TextEditor>();
            const uri = Uri.file(path.join('usr', 'file.py'));
            const document = TypeMoq.Mock.ofType<TextDocument>();
            textEditor.setup((t) => t.document).returns(() => document.object);
            document.setup((d) => d.uri).returns(() => uri);
            activeTextEditorChangeHandler!(textEditor.object);

            interpreterDisplay.verify((i) => i.refresh(TypeMoq.It.isValue(uri)), TypeMoq.Times.once());
        });

        test('If there is no active document then interpreter.refresh should not be invoked', async () => {
            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
            const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();

            experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
            experimentsManager
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            workspace.setup((w) => w.hasWorkspaceFolders).returns(() => true);
            workspace.setup((w) => w.workspaceFolders).returns(() => [{ uri: '' }] as any);
            let activeTextEditorChangeHandler: (e?: TextEditor | undefined) => any | undefined;
            documentManager
                .setup((d) => d.onDidChangeActiveTextEditor(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns((handler) => {
                    activeTextEditorChangeHandler = handler;
                    return { dispose: noop };
                });
            serviceManager.addSingletonInstance(IDocumentManager, documentManager.object);

            service.initialize();
            activeTextEditorChangeHandler!();

            interpreterDisplay.verify((i) => i.refresh(TypeMoq.It.isValue(undefined)), TypeMoq.Times.never());
        });

        test('If user belongs to Deprecate pythonPath experiment, register the correct handler', async () => {
            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
            const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();

            experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => true);
            experimentsManager
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            workspace.setup((w) => w.hasWorkspaceFolders).returns(() => true);
            workspace.setup((w) => w.workspaceFolders).returns(() => [{ uri: '' }] as any);
            let interpreterPathServiceHandler: (e: InterpreterConfigurationScope) => any | undefined = () => {
                return 0;
            };
            documentManager
                .setup((d) => d.onDidChangeActiveTextEditor(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => {
                    return { dispose: noop };
                });
            const i: InterpreterConfigurationScope = {
                uri: Uri.parse('a'),
                configTarget: ConfigurationTarget.Workspace,
            };
            configService.reset();
            configService
                .setup((c) => c.getSettings())
                .returns(() => pythonSettings.object)
                .verifiable(TypeMoq.Times.once());
            configService
                .setup((c) => c.getSettings(i.uri))
                .returns(() => pythonSettings.object)
                .verifiable(TypeMoq.Times.once());
            interpreterPathService
                .setup((d) => d.onDidChange(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .callback((cb) => {
                    interpreterPathServiceHandler = cb;
                })
                .returns(() => {
                    return { dispose: noop };
                });
            serviceManager.addSingletonInstance(IDocumentManager, documentManager.object);

            service.initialize();
            expect(interpreterPathServiceHandler).to.not.equal(undefined, 'Handler not set');

            interpreterPathServiceHandler!(i);

            // Ensure correct handler was invoked
            configService.verifyAll();
        });

        test('If stored setting is an empty string, refresh the interpreter display', async () => {
            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
            const resource = Uri.parse('a');
            service._pythonPathSetting = '';
            configService.reset();
            configService.setup((c) => c.getSettings(resource)).returns(() => ({ pythonPath: 'current path' } as any));
            interpreterDisplay
                .setup((i) => i.refresh())
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            service._onConfigChanged(resource);
            interpreterDisplay.verifyAll();
        });

        test('If stored setting is not equal to current interpreter path setting, refresh the interpreter display', async () => {
            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
            const resource = Uri.parse('a');
            service._pythonPathSetting = 'stored setting';
            configService.reset();
            configService.setup((c) => c.getSettings(resource)).returns(() => ({ pythonPath: 'current path' } as any));
            interpreterDisplay
                .setup((i) => i.refresh())
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            service._onConfigChanged(resource);
            interpreterDisplay.verifyAll();
        });

        test('If stored setting is equal to current interpreter path setting, do not refresh the interpreter display', async () => {
            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
            const resource = Uri.parse('a');
            service._pythonPathSetting = 'setting';
            configService.reset();
            configService.setup((c) => c.getSettings(resource)).returns(() => ({ pythonPath: 'setting' } as any));
            interpreterDisplay
                .setup((i) => i.refresh())
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());
            service._onConfigChanged(resource);
            interpreterDisplay.verifyAll();
        });
    });

    suite('Get Interpreter Details', () => {
        setup(setupSuite);
        [undefined, Uri.file('some workspace')].forEach((resource) => {
            test(`Ensure undefined is returned if we're unable to retrieve interpreter info (Resource is ${resource})`, async () => {
                const pythonPath = 'SOME VALUE';
                const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
                locator
                    .setup((l) => l.getInterpreters(TypeMoq.It.isValue(resource), TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve([]))
                    .verifiable(TypeMoq.Times.once());
                helper
                    .setup((h) => h.getInterpreterInformation(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.once());
                virtualEnvMgr
                    .setup((v) => v.getEnvironmentName(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(''))
                    .verifiable(TypeMoq.Times.once());
                virtualEnvMgr
                    .setup((v) => v.getEnvironmentType(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(EnvironmentType.Unknown))
                    .verifiable(TypeMoq.Times.once());
                pythonExecutionService
                    .setup((p) => p.getExecutablePath())
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

    suite('Caching Display name', () => {
        let getInterpreterHashStub: sinon.SinonStub;
        setup(() => {
            setupSuite();
            fileSystem.reset();
            persistentStateFactory.reset();
            getInterpreterHashStub = sinon.stub(hashApi, 'getInterpreterHash');
        });
        teardown(() => {
            getInterpreterHashStub.restore();
        });
        test('Return cached display name', async () => {
            const pythonPath = '1234';
            const interpreterInfo: Partial<PythonEnvironment> = { path: pythonPath };
            const hash = `-${md5(JSON.stringify({ ...interpreterInfo, displayName: '' }))}`;
            const expectedDisplayName = 'Formatted display name';

            getInterpreterHashStub.rejects({});
            persistentStateFactory
                .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => {
                    const state = {
                        updateValue: () => Promise.resolve(),
                        value: { hash, displayName: expectedDisplayName },
                    };
                    return state as any;
                })
                .verifiable(TypeMoq.Times.once());

            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
            const displayName = await service.getDisplayName(interpreterInfo, undefined);

            expect(displayName).to.equal(expectedDisplayName);
            persistentStateFactory.verifyAll();
        });
        test('Cached display name is not used if file hashes differ', async () => {
            const pythonPath = '1234';
            const interpreterInfo: Partial<PythonEnvironment> = { path: pythonPath };
            const fileHash = 'File_Hash';

            getInterpreterHashStub.withArgs(pythonPath).resolves(fileHash);
            const expectedDisplayName = 'Formatted display name';
            persistentStateFactory
                .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => {
                    const state = {
                        updateValue: () => Promise.resolve(),
                        value: { fileHash: 'something else', displayName: expectedDisplayName },
                    };
                    return state as any;
                })
                .verifiable(TypeMoq.Times.once());

            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
            const displayName = await service.getDisplayName(interpreterInfo, undefined).catch(() => '');

            expect(displayName).to.not.equal(expectedDisplayName);
            expect(getInterpreterHashStub.calledOnce).to.equal(true);
            persistentStateFactory.verifyAll();
        });
    });

    suite('Display name with incomplete interpreter versions', () => {
        let getInterpreterHashStub: sinon.SinonStub;

        setup(() => {
            setupSuite();
            fileSystem.reset();
            persistentStateFactory.reset();
            getInterpreterHashStub = sinon.stub(hashApi, 'getInterpreterHash');

            const fileHash = 'file_hash';
            getInterpreterHashStub.resolves(fileHash);
        });

        teardown(() => {
            getInterpreterHashStub.restore();
        });

        test('Python version without micro version should be displayed as X.Y and not default to X.Y.0', async () => {
            persistentStateFactory
                .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => {
                    const state = {
                        updateValue: () => Promise.resolve(),
                        value: undefined,
                    };
                    return state as any;
                })
                .verifiable(TypeMoq.Times.once());

            const interpreterInfo: Partial<PythonEnvironment> = {
                version: {
                    major: 2,
                    minor: 7,
                    patch: -1,
                    raw: 'something',
                    prerelease: [],
                    build: [],
                },
            };
            const expectedDisplayName = 'Python 2.7';

            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
            const displayName = await service.getDisplayName(interpreterInfo, undefined).catch(() => '');

            expect(displayName).to.equal(expectedDisplayName);
            expect(getInterpreterHashStub.notCalled).to.equal(true);
            persistentStateFactory.verifyAll();
        });

        test('Python version without minor or micro version should be displayed as X and not default to X.0.0', async () => {
            persistentStateFactory
                .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => {
                    const state = {
                        updateValue: () => Promise.resolve(),
                        value: undefined,
                    };
                    return state as any;
                })
                .verifiable(TypeMoq.Times.once());

            const interpreterInfo: Partial<PythonEnvironment> = {
                version: {
                    major: 3,
                    minor: -1,
                    patch: -1,
                    raw: 'something',
                    prerelease: [],
                    build: [],
                },
            };
            const expectedDisplayName = 'Python 3';

            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);
            const displayName = await service.getDisplayName(interpreterInfo, undefined).catch(() => '');

            expect(displayName).to.equal(expectedDisplayName);
            expect(getInterpreterHashStub.notCalled).to.equal(true);
            persistentStateFactory.verifyAll();
        });
    });

    // This is kind of a verbose test, but we need to ensure we have covered all permutations.
    // Also we have special handling for certain types of interpreters.
    suite('Display Format (with all permutations)', () => {
        setup(setupSuite);
        [undefined, Uri.file('xyz')].forEach((resource) => {
            [undefined, new SemVer('3.10.0-alpha6'), new SemVer('3.10.0')].forEach((version) => {
                // Forced cast to ignore TS warnings.
                (EnumEx.getNamesAndValues<Architecture>(Architecture) as (
                    | { name: string; value: Architecture }
                    | undefined
                )[])
                    .concat(undefined)
                    .forEach((arch) => {
                        [undefined, path.join('a', 'b', 'c', 'd', 'bin', 'python')].forEach((pythonPath) => {
                            // Forced cast to ignore TS warnings.
                            (EnumEx.getNamesAndValues<EnvironmentType>(EnvironmentType) as (
                                | { name: string; value: EnvironmentType }
                                | undefined
                            )[])
                                .concat(undefined)
                                .forEach((interpreterType) => {
                                    [undefined, 'my env name'].forEach((envName) => {
                                        ['', 'my pipenv name'].forEach((pipEnvName) => {
                                            const testName = [
                                                `${resource ? 'With' : 'Without'} a workspace`,
                                                `${version ? 'with' : 'without'} ${
                                                    version && version.prerelease.length > 0 ? 'pre-release' : 'final'
                                                } version information`,
                                                `${arch ? arch.name : 'without'} architecture`,
                                                `${pythonPath ? 'with' : 'without'} python Path`,
                                                `${
                                                    interpreterType
                                                        ? `${interpreterType.name} interpreter type`
                                                        : 'without interpreter type'
                                                }`,
                                                `${envName ? 'with' : 'without'} environment name`,
                                                `${pipEnvName ? 'with' : 'without'} pip environment`,
                                            ].join(', ');

                                            test(testName, async () => {
                                                const interpreterInfo: Partial<PythonEnvironment> = {
                                                    version,
                                                    architecture: arch ? arch.value : undefined,
                                                    envName,
                                                    envType: interpreterType ? interpreterType.value : undefined,
                                                    path: pythonPath,
                                                };

                                                if (
                                                    interpreterInfo.path &&
                                                    interpreterType &&
                                                    interpreterType.value === EnvironmentType.Pipenv
                                                ) {
                                                    virtualEnvMgr
                                                        .setup((v) =>
                                                            v.getEnvironmentName(
                                                                TypeMoq.It.isValue(interpreterInfo.path!),
                                                                TypeMoq.It.isAny(),
                                                            ),
                                                        )
                                                        .returns(() => Promise.resolve(pipEnvName));
                                                }
                                                if (interpreterType) {
                                                    helper
                                                        .setup((h) =>
                                                            h.getInterpreterTypeDisplayName(
                                                                TypeMoq.It.isValue(interpreterType.value),
                                                            ),
                                                        )
                                                        .returns(() => `${interpreterType!.name}_display`);
                                                }

                                                const service = new InterpreterService(
                                                    serviceContainer,
                                                    pyenvs.object,
                                                    experimentService.object,
                                                );
                                                const expectedDisplayName = buildDisplayName(interpreterInfo);

                                                const displayName = await service.getDisplayName(
                                                    interpreterInfo,
                                                    resource,
                                                );
                                                expect(displayName).to.equal(expectedDisplayName);
                                            });

                                            function buildVersionForDisplay(semVersion: PythonVersion): string {
                                                let preRelease = '';
                                                if (semVersion.prerelease.length > 0) {
                                                    switch (semVersion.prerelease[0]) {
                                                        case 'alpha':
                                                            preRelease = `a`;
                                                            break;
                                                        case 'beta':
                                                            preRelease = `b`;
                                                            break;
                                                        case 'candidate':
                                                            preRelease = `rc`;
                                                            break;
                                                        case 'final':
                                                        default:
                                                            break;
                                                    }
                                                }
                                                return `${semVersion.major}.${semVersion.minor}.${semVersion.patch}${preRelease}`;
                                            }

                                            function buildDisplayName(interpreterInfo: Partial<PythonEnvironment>) {
                                                const displayNameParts: string[] = ['Python'];
                                                const envSuffixParts: string[] = [];

                                                if (interpreterInfo.version) {
                                                    displayNameParts.push(
                                                        buildVersionForDisplay(interpreterInfo.version),
                                                    );
                                                }
                                                if (interpreterInfo.architecture) {
                                                    displayNameParts.push(
                                                        getArchitectureDisplayName(interpreterInfo.architecture),
                                                    );
                                                }
                                                if (
                                                    !interpreterInfo.envName &&
                                                    interpreterInfo.path &&
                                                    interpreterInfo.envType &&
                                                    interpreterInfo.envType === EnvironmentType.Pipenv &&
                                                    pipEnvName
                                                ) {
                                                    // If we do not have the name of the environment, then try to get it again.
                                                    // This can happen based on the context (i.e. resource).
                                                    // I.e. we can determine if an environment is PipEnv only when giving it the right workspacec path (i.e. resource).
                                                    interpreterInfo.envName = pipEnvName;
                                                }
                                                if (interpreterInfo.envName && interpreterInfo.envName.length > 0) {
                                                    envSuffixParts.push(`'${interpreterInfo.envName}'`);
                                                }
                                                if (interpreterInfo.envType) {
                                                    envSuffixParts.push(`${interpreterType!.name}_display`);
                                                }

                                                const envSuffix =
                                                    envSuffixParts.length === 0 ? '' : `(${envSuffixParts.join(': ')})`;
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

    suite('Interpreter Cache', () => {
        let getInterpreterHashStub: sinon.SinonStub;
        setup(() => {
            setupSuite();
            fileSystem.reset();
            persistentStateFactory.reset();
            getInterpreterHashStub = sinon.stub(hashApi, 'getInterpreterHash');
        });
        teardown(() => {
            getInterpreterHashStub.restore();
        });
        test('Ensure cache is returned', async () => {
            const fileHash = 'file_hash';
            const pythonPath = 'Some Python Path';
            getInterpreterHashStub.withArgs(pythonPath).resolves(fileHash);

            const state = TypeMoq.Mock.ofType<IPersistentState<{ fileHash: string; info?: PythonEnvironment }>>();
            const info = { path: 'hell', envType: EnvironmentType.Venv };
            state
                .setup((s) => s.value)
                .returns(() => {
                    return {
                        fileHash,
                        info: info as any,
                    };
                })
                .verifiable(TypeMoq.Times.atLeastOnce());
            state
                .setup((s) => s.updateValue(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());
            state.setup((s) => (s as any).then).returns(() => undefined);
            persistentStateFactory
                .setup((f) => f.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => state.object)
                .verifiable(TypeMoq.Times.once());

            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);

            const store = await service.getInterpreterCache(pythonPath);

            expect(store.value).to.deep.equal({ fileHash, info });
            state.verifyAll();
            persistentStateFactory.verifyAll();
            expect(getInterpreterHashStub.calledOnce).to.equal(true);
        });
        test('Ensure cache is cleared if file hash is different', async () => {
            const fileHash = 'file_hash';
            const pythonPath = 'Some Python Path';
            getInterpreterHashStub.withArgs(pythonPath).resolves('different value');

            const state = TypeMoq.Mock.ofType<IPersistentState<{ fileHash: string; info?: PythonEnvironment }>>();
            const info = { path: 'hell', envType: EnvironmentType.Venv };
            state
                .setup((s) => s.value)
                .returns(() => {
                    return {
                        fileHash,
                        info: info as any,
                    };
                })
                .verifiable(TypeMoq.Times.atLeastOnce());
            state
                .setup((s) => s.updateValue(TypeMoq.It.isValue({ fileHash: 'different value' })))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            state.setup((s) => (s as any).then).returns(() => undefined);
            persistentStateFactory
                .setup((f) => f.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => state.object)
                .verifiable(TypeMoq.Times.once());

            const service = new InterpreterService(serviceContainer, pyenvs.object, experimentService.object);

            const store = await service.getInterpreterCache(pythonPath);

            expect(store.value.info).to.deep.equal(info);
            state.verifyAll();
            persistentStateFactory.verifyAll();
            expect(getInterpreterHashStub.calledOnce).to.equal(true);
        });
    });
});
