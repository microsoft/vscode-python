// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length no-invalid-this

import * as path from 'path';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { Disposable, OutputChannel, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { CondaInstaller } from '../../../client/common/installer/condaInstaller';
import { PipEnvInstaller, pipenvName } from '../../../client/common/installer/pipEnvInstaller';
import { PipInstaller } from '../../../client/common/installer/pipInstaller';
import { ProductInstaller } from '../../../client/common/installer/productInstaller';
import { IInstallationChannelManager, IModuleInstaller } from '../../../client/common/installer/types';
import { ITerminalService, ITerminalServiceFactory } from '../../../client/common/terminal/types';
import { IConfigurationService, IDisposableRegistry, IPythonSettings, ModuleNamePurpose, Product } from '../../../client/common/types';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { noop } from '../../../client/common/utils/misc';
import { ICondaService, IInterpreterService, InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
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
    const pythonPath = path.join(__dirname, 'python');
    [CondaInstaller, PipInstaller, PipEnvInstaller].forEach(installerClass => {
        // Proxy info is relevant only for PipInstaller.
        const proxyServers = installerClass === PipInstaller ? ['', 'proxy:1234'] : [''];
        proxyServers.forEach(proxyServer => {
            [undefined, Uri.file('/users/dev/xyz')].forEach(resource => {
                // Conda info is relevant only for CondaInstaller.
                const condaEnvs = installerClass === CondaInstaller ? [
                    { name: 'My-Env01', path: '' }, { name: '', path: path.join('conda', 'path') },
                    { name: 'My-Env01 With Spaces', path: '' }, { name: '', path: path.join('conda with spaces', 'path') }
                ] : [];
                [undefined, ...condaEnvs].forEach(condaEnvInfo => {
                    const testProxySuffix = proxyServer.length === 0 ? 'without proxy info' : 'with proxy info';
                    const testCondaEnv = condaEnvInfo ? (condaEnvInfo.name ? 'without conda name' : 'with conda path') : 'without conda';
                    const testSuite = [testProxySuffix, testCondaEnv].filter(item => item.length > 0).join(', ');
                    suite(`${installerClass.name} (${testSuite})`, () => {
                        let disposables: Disposable[] = [];
                        let installer: IModuleInstaller;
                        let installationChannel: TypeMoq.IMock<IInstallationChannelManager>;
                        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
                        let terminalService: TypeMoq.IMock<ITerminalService>;
                        let pythonSettings: TypeMoq.IMock<IPythonSettings>;
                        let interpreterService: TypeMoq.IMock<IInterpreterService>;
                        const condaExecutable = 'my.exe';
                        setup(() => {
                            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();

                            disposables = [];
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny())).returns(() => disposables);

                            installationChannel = TypeMoq.Mock.ofType<IInstallationChannelManager>();
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInstallationChannelManager), TypeMoq.It.isAny())).returns(() => installationChannel.object);

                            const condaService = TypeMoq.Mock.ofType<ICondaService>();
                            condaService.setup(c => c.getCondaFile()).returns(() => Promise.resolve(condaExecutable));
                            condaService.setup(c => c.getCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(condaEnvInfo));

                            const configService = TypeMoq.Mock.ofType<IConfigurationService>();
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny())).returns(() => configService.object);
                            pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
                            pythonSettings.setup(p => p.pythonPath).returns(() => pythonPath);
                            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

                            terminalService = TypeMoq.Mock.ofType<ITerminalService>();
                            const terminalServiceFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
                            terminalServiceFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => terminalService.object);
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ITerminalServiceFactory), TypeMoq.It.isAny())).returns(() => terminalServiceFactory.object);

                            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterService), TypeMoq.It.isAny())).returns(() => interpreterService.object);
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICondaService), TypeMoq.It.isAny())).returns(() => condaService.object);

                            const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService), TypeMoq.It.isAny())).returns(() => workspaceService.object);
                            const http = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
                            http.setup(h => h.get(TypeMoq.It.isValue('proxy'), TypeMoq.It.isAny())).returns(() => proxyServer);
                            workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('http'))).returns(() => http.object);

                            installer = new installerClass(serviceContainer.object);
                        });
                        teardown(() => {
                            disposables.forEach(disposable => {
                                if (disposable) {
                                    disposable.dispose();
                                }
                            });
                        });
                        function setActiveInterpreter(activeInterpreter?: PythonInterpreter) {
                            interpreterService
                                .setup(i => i.getActiveInterpreter(TypeMoq.It.isValue(resource)))
                                .returns(() => Promise.resolve(activeInterpreter))
                                .verifiable(TypeMoq.Times.atLeastOnce());
                        }
                        getModuleNamesForTesting().forEach(product => {
                            const moduleName = product.moduleName;
                            async function installModuleAndVerifyCommand(command: string, expectedArgs: string[]) {
                                terminalService.setup(t => t.sendCommand(TypeMoq.It.isValue(command), TypeMoq.It.isValue(expectedArgs)))
                                    .returns(() => Promise.resolve())
                                    .verifiable(TypeMoq.Times.once());

                                await installer.installModule(moduleName, resource);
                                terminalService.verifyAll();
                            }

                            if (product.value === Product.pylint) {
                                // tslint:disable-next-line:no-shadowed-variable
                                generatePythonInterpreterVersions().forEach(interpreterInfo => {
                                    const majorVersion = interpreterInfo.version ? interpreterInfo.version.major : 0;
                                    if (majorVersion === 2) {
                                        const testTitle = `Ensure install arg is \'pylint<2.0.0\' in ${interpreterInfo.version ? interpreterInfo.version.raw : ''}`;
                                        if (installerClass === PipInstaller) {
                                            test(testTitle, async () => {
                                                setActiveInterpreter(interpreterInfo);
                                                const proxyArgs = proxyServer.length === 0 ? [] : ['--proxy', proxyServer];
                                                const expectedArgs = ['-m', 'pip', ...proxyArgs, 'install', '-U', '"pylint<2.0.0"'];
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
                                                await installModuleAndVerifyCommand(condaExecutable, expectedArgs);
                                            });
                                        }
                                    } else {
                                        const testTitle = `Ensure install arg is \'pylint\' in ${interpreterInfo.version ? interpreterInfo.version.raw : ''}`;
                                        if (installerClass === PipInstaller) {
                                            test(testTitle, async () => {
                                                setActiveInterpreter(interpreterInfo);
                                                const proxyArgs = proxyServer.length === 0 ? [] : ['--proxy', proxyServer];
                                                const expectedArgs = ['-m', 'pip', ...proxyArgs, 'install', '-U', 'pylint'];
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
                                                await installModuleAndVerifyCommand(condaExecutable, expectedArgs);
                                            });
                                        }
                                    }
                                });
                                return;
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
    const versions: SemVer[] = ['2.7.0-final', '3.4.0-final', '3.5.0-final', '3.6.0-final', '3.7.0-final'].map(ver => new SemVer(ver));
    return versions.map(version => {
        const info = TypeMoq.Mock.ofType<PythonInterpreter>();
        info.setup((t: any) => t.then).returns(() => undefined);
        info.setup(t => t.type).returns(() => InterpreterType.VirtualEnv);
        info.setup(t => t.version).returns(() => version);
        return info.object;
    });
}

function getModuleNamesForTesting(): { name: string; value: Product; moduleName: string }[] {
    return getNamesAndValues<Product>(Product)
        .map(product => {
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
        .filter(item => item !== undefined) as { name: string; value: Product; moduleName: string }[];
}
