// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length no-invalid-this

import { assert } from 'chai';
import * as path from 'path';
// tslint:disable-next-line: match-default-export-name
import rewiremock from 'rewiremock';
import { SemVer } from 'semver';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import {
    CancellationTokenSource,
    Disposable,
    OutputChannel,
    ProgressLocation,
    Uri,
    WorkspaceConfiguration,
} from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../../client/common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../../client/common/constants';
import { CondaInstaller } from '../../../client/common/installer/condaInstaller';
import { ModuleInstaller } from '../../../client/common/installer/moduleInstaller';
import { PipEnvInstaller, pipenvName } from '../../../client/common/installer/pipEnvInstaller';
import { PipInstaller } from '../../../client/common/installer/pipInstaller';
import { ProductInstaller } from '../../../client/common/installer/productInstaller';
import { IInstallationChannelManager, IModuleInstaller, InterpreterUri } from '../../../client/common/installer/types';
import { IFileSystem } from '../../../client/common/platform/types';
import { ITerminalService, ITerminalServiceFactory } from '../../../client/common/terminal/types';
import {
    ExecutionInfo,
    IConfigurationService,
    IDisposableRegistry,
    IOutputChannel,
    IPythonSettings,
    ModuleNamePurpose,
    Product,
} from '../../../client/common/types';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { Products } from '../../../client/common/utils/localize';
import { noop } from '../../../client/common/utils/misc';
import {
    ICondaService,
    IInterpreterService,
    InterpreterType,
    PythonInterpreter,
} from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';

/* Complex test to ensure we cover all combinations:
We could have written separate tests for each installer, but we'd be replicate code.
Both approachs have their benefits.

Comnbinations of:
1. With and without a workspace.
2. Http Proxy configuration.
3. All products.
4. Different versions of Python.
5. With and without conda.
6. Conda environments with names and without names.
7. All installers.
*/
suite('Module Installer', () => {
    class TestModuleInstaller extends ModuleInstaller {
        public get priority(): number {
            return 0;
        }
        public get name(): string {
            return '';
        }
        public get displayName(): string {
            return '';
        }
        public isSupported(_resource?: InterpreterUri): Promise<boolean> {
            return Promise.resolve(false);
        }
        public getExecutionInfo(_moduleName: string, _resource?: InterpreterUri): Promise<ExecutionInfo> {
            return Promise.resolve({ moduleName: 'executionInfo', args: [] });
        }
        // tslint:disable-next-line: no-unnecessary-override
        public elevatedInstall(execPath: string, args: string[]) {
            return super.elevatedInstall(execPath, args);
        }
    }
    let outputChannel: TypeMoq.IMock<IOutputChannel>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    const pythonPath = path.join(__dirname, 'python');

    suite('Method _elevatedInstall()', async () => {
        let installer: TestModuleInstaller;
        const execPath = 'execPath';
        const args = ['1', '2'];
        const command = `"${execPath.replace(/\\/g, '/')}" ${args.join(' ')}`;
        setup(() => {
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
            outputChannel = TypeMoq.Mock.ofType<IOutputChannel>();
            serviceContainer
                .setup((c) => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isValue(STANDARD_OUTPUT_CHANNEL)))
                .returns(() => outputChannel.object);
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
            installer = new TestModuleInstaller(serviceContainer.object);
        });
        teardown(() => {
            rewiremock.disable();
        });

        test('Show error message if sudo exec fails with error', async () => {
            const error = 'Error message';
            const sudoPromptMock = {
                exec: (_command: any, _options: any, callBackFn: Function) => callBackFn(error, 'stdout', 'stderr'),
            };
            rewiremock.enable();
            rewiremock('sudo-prompt').with(sudoPromptMock);
            appShell
                .setup((a) => a.showErrorMessage(error))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            outputChannel
                // tslint:disable-next-line: messages-must-be-localized
                .setup((o) => o.appendLine(`[Elevated] ${command}`))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            installer.elevatedInstall(execPath, args);
            appShell.verifyAll();
            outputChannel.verifyAll();
        });

        test('Show stdout if sudo exec succeeds', async () => {
            const stdout = 'stdout';
            const sudoPromptMock = {
                exec: (_command: any, _options: any, callBackFn: Function) => callBackFn(undefined, stdout, undefined),
            };
            rewiremock.enable();
            rewiremock('sudo-prompt').with(sudoPromptMock);
            outputChannel
                .setup((o) => o.show())
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            outputChannel
                // tslint:disable-next-line: messages-must-be-localized
                .setup((o) => o.appendLine(`[Elevated] ${command}`))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            outputChannel
                .setup((o) => o.append(stdout))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            installer.elevatedInstall(execPath, args);
            outputChannel.verifyAll();
        });

        test('Show stderr if sudo exec gives a warning with stderr', async () => {
            const stderr = 'stderr';
            const sudoPromptMock = {
                exec: (_command: any, _options: any, callBackFn: Function) => callBackFn(undefined, undefined, stderr),
            };
            rewiremock.enable();
            rewiremock('sudo-prompt').with(sudoPromptMock);
            outputChannel
                // tslint:disable-next-line: messages-must-be-localized
                .setup((o) => o.appendLine(`[Elevated] ${command}`))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            outputChannel
                .setup((o) => o.show())
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            outputChannel
                // tslint:disable-next-line: messages-must-be-localized
                .setup((o) => o.append(`Warning: ${stderr}`))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            installer.elevatedInstall(execPath, args);
            outputChannel.verifyAll();
        });
    });

    [CondaInstaller, PipInstaller, PipEnvInstaller, TestModuleInstaller].forEach((installerClass) => {
        // Proxy info is relevant only for PipInstaller.
        const proxyServers = installerClass === PipInstaller ? ['', 'proxy:1234'] : [''];
        proxyServers.forEach((proxyServer) => {
            [undefined, Uri.file('/users/dev/xyz')].forEach((resource) => {
                // Conda info is relevant only for CondaInstaller.
                const condaEnvs =
                    installerClass === CondaInstaller
                        ? [
                              { name: 'My-Env01', path: '' },
                              { name: '', path: path.join('conda', 'path') },
                              { name: 'My-Env01 With Spaces', path: '' },
                              { name: '', path: path.join('conda with spaces', 'path') },
                          ]
                        : [];
                [undefined, ...condaEnvs].forEach((condaEnvInfo) => {
                    const testProxySuffix = proxyServer.length === 0 ? 'without proxy info' : 'with proxy info';
                    const testCondaEnv = condaEnvInfo
                        ? condaEnvInfo.name
                            ? 'without conda name'
                            : 'with conda path'
                        : 'without conda';
                    const testSuite = [testProxySuffix, testCondaEnv].filter((item) => item.length > 0).join(', ');
                    suite(`${installerClass.name} (${testSuite})`, () => {
                        let disposables: Disposable[] = [];
                        let installationChannel: TypeMoq.IMock<IInstallationChannelManager>;
                        let terminalService: TypeMoq.IMock<ITerminalService>;
                        let configService: TypeMoq.IMock<IConfigurationService>;
                        let fs: TypeMoq.IMock<IFileSystem>;
                        let pythonSettings: TypeMoq.IMock<IPythonSettings>;
                        let interpreterService: TypeMoq.IMock<IInterpreterService>;
                        let installer: IModuleInstaller;
                        const condaExecutable = 'my.exe';
                        setup(() => {
                            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();

                            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
                            serviceContainer
                                .setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell)))
                                .returns(() => appShell.object);

                            fs = TypeMoq.Mock.ofType<IFileSystem>();
                            serviceContainer
                                .setup((c) => c.get(TypeMoq.It.isValue(IFileSystem)))
                                .returns(() => fs.object);

                            disposables = [];
                            serviceContainer
                                .setup((c) => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny()))
                                .returns(() => disposables);

                            installationChannel = TypeMoq.Mock.ofType<IInstallationChannelManager>();
                            serviceContainer
                                .setup((c) =>
                                    c.get(TypeMoq.It.isValue(IInstallationChannelManager), TypeMoq.It.isAny())
                                )
                                .returns(() => installationChannel.object);

                            const condaService = TypeMoq.Mock.ofType<ICondaService>();
                            condaService.setup((c) => c.getCondaFile()).returns(() => Promise.resolve(condaExecutable));
                            condaService
                                .setup((c) => c.getCondaEnvironment(TypeMoq.It.isAny()))
                                .returns(() => Promise.resolve(condaEnvInfo));

                            configService = TypeMoq.Mock.ofType<IConfigurationService>();
                            serviceContainer
                                .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny()))
                                .returns(() => configService.object);
                            pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
                            pythonSettings.setup((p) => p.pythonPath).returns(() => pythonPath);
                            configService
                                .setup((c) => c.getSettings(TypeMoq.It.isAny()))
                                .returns(() => pythonSettings.object);

                            terminalService = TypeMoq.Mock.ofType<ITerminalService>();
                            const terminalServiceFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
                            terminalServiceFactory
                                .setup((f) => f.getTerminalService(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                                .returns(() => terminalService.object);
                            serviceContainer
                                .setup((c) => c.get(TypeMoq.It.isValue(ITerminalServiceFactory), TypeMoq.It.isAny()))
                                .returns(() => terminalServiceFactory.object);

                            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
                            serviceContainer
                                .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService), TypeMoq.It.isAny()))
                                .returns(() => interpreterService.object);
                            serviceContainer
                                .setup((c) => c.get(TypeMoq.It.isValue(ICondaService), TypeMoq.It.isAny()))
                                .returns(() => condaService.object);

                            const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                            serviceContainer
                                .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService), TypeMoq.It.isAny()))
                                .returns(() => workspaceService.object);
                            const http = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
                            http.setup((h) => h.get(TypeMoq.It.isValue('proxy'), TypeMoq.It.isAny())).returns(
                                () => proxyServer
                            );
                            workspaceService
                                .setup((w) => w.getConfiguration(TypeMoq.It.isValue('http')))
                                .returns(() => http.object);

                            installer = new installerClass(serviceContainer.object);
                        });
                        teardown(() => {
                            disposables.forEach((disposable) => {
                                if (disposable) {
                                    disposable.dispose();
                                }
                            });
                            sinon.restore();
                        });
                        function setActiveInterpreter(activeInterpreter?: PythonInterpreter) {
                            interpreterService
                                .setup((i) => i.getActiveInterpreter(TypeMoq.It.isValue(resource)))
                                .returns(() => Promise.resolve(activeInterpreter))
                                .verifiable(TypeMoq.Times.atLeastOnce());
                        }
                        getModuleNamesForTesting().forEach((product) => {
                            const moduleName = product.moduleName;
                            async function installModuleAndVerifyCommand(command: string, expectedArgs: string[]) {
                                terminalService
                                    .setup((t) =>
                                        t.sendCommand(
                                            TypeMoq.It.isValue(command),
                                            TypeMoq.It.isValue(expectedArgs),
                                            TypeMoq.It.isValue(undefined)
                                        )
                                    )
                                    .returns(() => Promise.resolve())
                                    .verifiable(TypeMoq.Times.once());

                                await installer.installModule(moduleName, resource);
                                terminalService.verifyAll();
                            }

                            if (product.value === Product.pylint) {
                                // tslint:disable-next-line:no-shadowed-variable
                                generatePythonInterpreterVersions().forEach((interpreterInfo) => {
                                    const majorVersion = interpreterInfo.version ? interpreterInfo.version.major : 0;
                                    if (majorVersion === 2) {
                                        const testTitle = `Ensure install arg is \'pylint<2.0.0\' in ${
                                            interpreterInfo.version ? interpreterInfo.version.raw : ''
                                        }`;
                                        if (installerClass === PipInstaller) {
                                            test(testTitle, async () => {
                                                setActiveInterpreter(interpreterInfo);
                                                const proxyArgs =
                                                    proxyServer.length === 0 ? [] : ['--proxy', proxyServer];
                                                const expectedArgs = [
                                                    '-m',
                                                    'pip',
                                                    ...proxyArgs,
                                                    'install',
                                                    '-U',
                                                    '"pylint<2.0.0"',
                                                ];
                                                await installModuleAndVerifyCommand(pythonPath, expectedArgs);
                                            });
                                        }
                                        if (installerClass === PipEnvInstaller) {
                                            test(testTitle, async () => {
                                                setActiveInterpreter(interpreterInfo);
                                                const expectedArgs = ['install', '"pylint<2.0.0"', '--dev'];
                                                await installModuleAndVerifyCommand(pipenvName, expectedArgs);
                                            });
                                        }
                                        if (installerClass === CondaInstaller) {
                                            test(testTitle, async () => {
                                                setActiveInterpreter(interpreterInfo);
                                                const expectedArgs = ['install'];
                                                if (condaEnvInfo && condaEnvInfo.name) {
                                                    expectedArgs.push('--name');
                                                    expectedArgs.push(condaEnvInfo.name.toCommandArgument());
                                                } else if (condaEnvInfo && condaEnvInfo.path) {
                                                    expectedArgs.push('--prefix');
                                                    expectedArgs.push(condaEnvInfo.path.fileToCommandArgument());
                                                }
                                                expectedArgs.push('"pylint<2.0.0"');
                                                expectedArgs.push('-y');
                                                await installModuleAndVerifyCommand(condaExecutable, expectedArgs);
                                            });
                                        }
                                    } else {
                                        const testTitle = `Ensure install arg is \'pylint\' in ${
                                            interpreterInfo.version ? interpreterInfo.version.raw : ''
                                        }`;
                                        if (installerClass === PipInstaller) {
                                            test(testTitle, async () => {
                                                setActiveInterpreter(interpreterInfo);
                                                const proxyArgs =
                                                    proxyServer.length === 0 ? [] : ['--proxy', proxyServer];
                                                const expectedArgs = [
                                                    '-m',
                                                    'pip',
                                                    ...proxyArgs,
                                                    'install',
                                                    '-U',
                                                    'pylint',
                                                ];
                                                await installModuleAndVerifyCommand(pythonPath, expectedArgs);
                                            });
                                        }
                                        if (installerClass === PipEnvInstaller) {
                                            test(testTitle, async () => {
                                                setActiveInterpreter(interpreterInfo);
                                                const expectedArgs = ['install', 'pylint', '--dev'];
                                                await installModuleAndVerifyCommand(pipenvName, expectedArgs);
                                            });
                                        }
                                        if (installerClass === CondaInstaller) {
                                            test(testTitle, async () => {
                                                setActiveInterpreter(interpreterInfo);
                                                const expectedArgs = ['install'];
                                                if (condaEnvInfo && condaEnvInfo.name) {
                                                    expectedArgs.push('--name');
                                                    expectedArgs.push(condaEnvInfo.name.toCommandArgument());
                                                } else if (condaEnvInfo && condaEnvInfo.path) {
                                                    expectedArgs.push('--prefix');
                                                    expectedArgs.push(condaEnvInfo.path.fileToCommandArgument());
                                                }
                                                expectedArgs.push('pylint');
                                                expectedArgs.push('-y');
                                                await installModuleAndVerifyCommand(condaExecutable, expectedArgs);
                                            });
                                        }
                                    }
                                });
                                return;
                            }

                            if (installerClass === TestModuleInstaller) {
                                suite(`If interpreter type is Unknown (${product.name})`, async () => {
                                    test(`If 'python.globalModuleInstallation' is set to true and pythonPath directory is read only, do an elevated install`, async () => {
                                        const info = TypeMoq.Mock.ofType<PythonInterpreter>();
                                        info.setup((t: any) => t.then).returns(() => undefined);
                                        info.setup((t) => t.type).returns(() => InterpreterType.Unknown);
                                        info.setup((t) => t.version).returns(() => new SemVer('3.5.0-final'));
                                        setActiveInterpreter(info.object);
                                        pythonSettings.setup((p) => p.globalModuleInstallation).returns(() => true);
                                        const elevatedInstall = sinon.stub(
                                            TestModuleInstaller.prototype,
                                            'elevatedInstall'
                                        );
                                        elevatedInstall.returns();
                                        fs.setup((f) => f.isDirReadonly(path.dirname(pythonPath))).returns(() =>
                                            Promise.resolve(true)
                                        );
                                        try {
                                            await installer.installModule(product.name, resource);
                                        } catch (ex) {
                                            noop();
                                        }
                                        assert.ok(elevatedInstall.calledOnceWith(pythonPath, ['-m', 'executionInfo']));
                                        interpreterService.verifyAll();
                                    });
                                    test(`If 'python.globalModuleInstallation' is set to true and pythonPath directory is not read only, send command to terminal`, async () => {
                                        const info = TypeMoq.Mock.ofType<PythonInterpreter>();
                                        info.setup((t: any) => t.then).returns(() => undefined);
                                        info.setup((t) => t.type).returns(() => InterpreterType.Unknown);
                                        info.setup((t) => t.version).returns(() => new SemVer('3.5.0-final'));
                                        setActiveInterpreter(info.object);
                                        pythonSettings.setup((p) => p.globalModuleInstallation).returns(() => true);
                                        fs.setup((f) => f.isDirReadonly(path.dirname(pythonPath))).returns(() =>
                                            Promise.resolve(false)
                                        );
                                        terminalService
                                            .setup((t) => t.sendCommand(pythonPath, ['-m', 'executionInfo'], undefined))
                                            .returns(() => Promise.resolve())
                                            .verifiable(TypeMoq.Times.once());
                                        try {
                                            await installer.installModule(product.name, resource);
                                        } catch (ex) {
                                            noop();
                                        }
                                        interpreterService.verifyAll();
                                        terminalService.verifyAll();
                                    });
                                    test(`If 'python.globalModuleInstallation' is not set to true, concanate arguments with '--user' flag and send command to terminal`, async () => {
                                        const info = TypeMoq.Mock.ofType<PythonInterpreter>();
                                        info.setup((t: any) => t.then).returns(() => undefined);
                                        info.setup((t) => t.type).returns(() => InterpreterType.Unknown);
                                        info.setup((t) => t.version).returns(() => new SemVer('3.5.0-final'));
                                        setActiveInterpreter(info.object);
                                        pythonSettings.setup((p) => p.globalModuleInstallation).returns(() => false);
                                        terminalService
                                            .setup((t) =>
                                                t.sendCommand(pythonPath, ['-m', 'executionInfo', '--user'], undefined)
                                            )
                                            .returns(() => Promise.resolve())
                                            .verifiable(TypeMoq.Times.once());
                                        try {
                                            await installer.installModule(product.name, resource);
                                        } catch (ex) {
                                            noop();
                                        }
                                        interpreterService.verifyAll();
                                        terminalService.verifyAll();
                                    });
                                    test(`ignores failures in IFileSystem.isDirReadonly()`, async () => {
                                        const info = TypeMoq.Mock.ofType<PythonInterpreter>();
                                        info.setup((t: any) => t.then).returns(() => undefined);
                                        info.setup((t) => t.type).returns(() => InterpreterType.Unknown);
                                        info.setup((t) => t.version).returns(() => new SemVer('3.5.0-final'));
                                        setActiveInterpreter(info.object);
                                        pythonSettings.setup((p) => p.globalModuleInstallation).returns(() => true);
                                        const elevatedInstall = sinon.stub(
                                            TestModuleInstaller.prototype,
                                            'elevatedInstall'
                                        );
                                        elevatedInstall.returns();
                                        const err = new Error('oops!');
                                        fs.setup((f) => f.isDirReadonly(path.dirname(pythonPath))).returns(() =>
                                            Promise.reject(err)
                                        );
                                        try {
                                            await installer.installModule(product.name, resource);
                                        } catch (ex) {
                                            noop();
                                        }
                                        assert.ok(elevatedInstall.calledOnceWith(pythonPath, ['-m', 'executionInfo']));
                                        interpreterService.verifyAll();
                                    });
                                    test('If cancellation token is provided, install while showing progress', async () => {
                                        const options = {
                                            location: ProgressLocation.Notification,
                                            cancellable: true,
                                            title: Products.installingModule().format(product.name),
                                        };
                                        appShell
                                            .setup((a) => a.withProgress(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                                            .callback((expected, _) => assert.deepEqual(expected, options))
                                            .returns(() => Promise.resolve())
                                            .verifiable(TypeMoq.Times.once());
                                        try {
                                            await installer.installModule(
                                                product.name,
                                                resource,
                                                new CancellationTokenSource().token
                                            );
                                        } catch (ex) {
                                            noop();
                                        }
                                        interpreterService.verifyAll();
                                        appShell.verifyAll();
                                    });
                                });
                            }

                            if (installerClass === PipInstaller) {
                                test(`Ensure getActiveInterpreter is used in PipInstaller (${product.name})`, async () => {
                                    setActiveInterpreter();
                                    try {
                                        await installer.installModule(product.name, resource);
                                    } catch {
                                        noop();
                                    }
                                    interpreterService.verifyAll();
                                });
                            }
                            if (installerClass === PipInstaller) {
                                test(`Test Args (${product.name})`, async () => {
                                    setActiveInterpreter();
                                    const proxyArgs = proxyServer.length === 0 ? [] : ['--proxy', proxyServer];
                                    const expectedArgs = ['-m', 'pip', ...proxyArgs, 'install', '-U', moduleName];
                                    await installModuleAndVerifyCommand(pythonPath, expectedArgs);
                                    interpreterService.verifyAll();
                                });
                            }
                            if (installerClass === PipEnvInstaller) {
                                test(`Test args (${product.name})`, async () => {
                                    setActiveInterpreter();
                                    const expectedArgs = ['install', moduleName, '--dev'];
                                    if (moduleName === 'black') {
                                        expectedArgs.push('--pre');
                                    }
                                    await installModuleAndVerifyCommand(pipenvName, expectedArgs);
                                });
                            }
                            if (installerClass === CondaInstaller) {
                                test(`Test args (${product.name})`, async () => {
                                    setActiveInterpreter();
                                    const expectedArgs = ['install'];
                                    if (condaEnvInfo && condaEnvInfo.name) {
                                        expectedArgs.push('--name');
                                        expectedArgs.push(condaEnvInfo.name.toCommandArgument());
                                    } else if (condaEnvInfo && condaEnvInfo.path) {
                                        expectedArgs.push('--prefix');
                                        expectedArgs.push(condaEnvInfo.path.fileToCommandArgument());
                                    }
                                    expectedArgs.push(moduleName);
                                    expectedArgs.push('-y');
                                    await installModuleAndVerifyCommand(condaExecutable, expectedArgs);
                                });
                            }
                        });
                    });
                });
            });
        });
    });
});

function generatePythonInterpreterVersions() {
    const versions: SemVer[] = ['2.7.0-final', '3.4.0-final', '3.5.0-final', '3.6.0-final', '3.7.0-final'].map(
        (ver) => new SemVer(ver)
    );
    return versions.map((version) => {
        const info = TypeMoq.Mock.ofType<PythonInterpreter>();
        info.setup((t: any) => t.then).returns(() => undefined);
        info.setup((t) => t.type).returns(() => InterpreterType.VirtualEnv);
        info.setup((t) => t.version).returns(() => version);
        return info.object;
    });
}

function getModuleNamesForTesting(): { name: string; value: Product; moduleName: string }[] {
    return getNamesAndValues<Product>(Product)
        .map((product) => {
            let moduleName = '';
            const mockSvc = TypeMoq.Mock.ofType<IServiceContainer>().object;
            const mockOutChnl = TypeMoq.Mock.ofType<OutputChannel>().object;
            try {
                const prodInstaller = new ProductInstaller(mockSvc, mockOutChnl);
                moduleName = prodInstaller.translateProductToModuleName(product.value, ModuleNamePurpose.install);
                return { name: product.name, value: product.value, moduleName };
            } catch {
                return;
            }
        })
        .filter((item) => item !== undefined) as { name: string; value: Product; moduleName: string }[];
}
