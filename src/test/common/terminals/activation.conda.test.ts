// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length no-any

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Disposable } from 'vscode';
import { EnumEx } from '../../../client/common/enumUtils';
import '../../../client/common/extensions';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { IProcessService, IProcessServiceFactory } from '../../../client/common/process/types';
import { CondaActivationCommandProvider } from '../../../client/common/terminal/environmentActivationProviders/condaActivationProvider';
import { TerminalHelper } from '../../../client/common/terminal/helper';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../../../client/common/terminal/types';
import { IConfigurationService, IDisposableRegistry, IPythonSettings, ITerminalSettings } from '../../../\client/common/types';
import { ICondaService } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Terminal Environment Activation conda', () => {
    let terminalHelper: TerminalHelper;
    let disposables: Disposable[] = [];
    let terminalSettings: TypeMoq.IMock<ITerminalSettings>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let processService: TypeMoq.IMock<IProcessService>;
    let procServiceFactory: TypeMoq.IMock<IProcessServiceFactory>;
    let condaService: TypeMoq.IMock<ICondaService>;

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        disposables = [];
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny())).returns(() => disposables);

        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        processService = TypeMoq.Mock.ofType<IProcessService>();
        condaService = TypeMoq.Mock.ofType<ICondaService>();
        processService.setup((x: any) => x.then).returns(() => undefined);
        procServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        procServiceFactory.setup(p => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));

        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService), TypeMoq.It.isAny())).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem), TypeMoq.It.isAny())).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProcessServiceFactory), TypeMoq.It.isAny())).returns(() => procServiceFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICondaService), TypeMoq.It.isAny())).returns(() => condaService.object);

        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

        terminalSettings = TypeMoq.Mock.ofType<ITerminalSettings>();
        pythonSettings.setup(s => s.terminal).returns(() => terminalSettings.object);

        terminalHelper = new TerminalHelper(serviceContainer.object);
    });
    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });
    });

    test('Ensure no activation commands are returned if the feature is disabled', async () => {
        terminalSettings.setup(t => t.activateEnvironment).returns(() => false);

        const activationCommands = await terminalHelper.getEnvironmentActivationCommands(TerminalShellType.bash, undefined);
        expect(activationCommands).to.equal(undefined, 'Activation commands should be undefined');
    });

    async function expectNoCondaActivationCommandForPowershell(isWindows: boolean, isOsx: boolean, isLinux: boolean, pythonPath: string, shellType: TerminalShellType, hasSpaceInEnvironmentName = false) {
        terminalSettings.setup(t => t.activateEnvironment).returns(() => true);
        platformService.setup(p => p.isLinux).returns(() => isLinux);
        platformService.setup(p => p.isWindows).returns(() => isWindows);
        platformService.setup(p => p.isMac).returns(() => isOsx);
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
        pythonSettings.setup(s => s.pythonPath).returns(() => pythonPath);
        const envName = hasSpaceInEnvironmentName ? 'EnvA' : 'Env A';
        condaService.setup(c => c.getCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve({ name: envName, path: path.dirname(pythonPath) }));

        const activationCommands = await new CondaActivationCommandProvider(serviceContainer.object).getActivationCommands(undefined, shellType);
        let expectedActivationCommamnd: string[] | undefined;
        switch (shellType) {
            case TerminalShellType.powershell:
            case TerminalShellType.powershellCore: {
                const powershellExe = shellType === TerminalShellType.powershell ? 'powershell' : 'pwsh';
                const envNameForCmd = envName.toCommandArgument().replace(/"/g, '""');
                expectedActivationCommamnd = isWindows ? [`& cmd /k \"activate ${envNameForCmd} & ${powershellExe}\"`] : undefined;
                break;
            }
            case TerminalShellType.fish: {
                expectedActivationCommamnd = [`conda activate ${envName.toCommandArgument()}`];
                break;
            }
            default: {
                expectedActivationCommamnd = isWindows ? [`activate ${envName.toCommandArgument()}`] : [`source activate ${envName.toCommandArgument()}`];
                break;
            }
        }
        expect(activationCommands).to.deep.equal(expectedActivationCommamnd, 'Incorrect Activation command');
    }
    EnumEx.getNamesAndValues(TerminalShellType).forEach(shellType => {
        test(`Conda activation command for shell ${shellType.name} on (windows)`, async () => {
            const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'enva', 'python.exe');
            await expectNoCondaActivationCommandForPowershell(true, false, false, pythonPath, shellType.value);
        });

        test(`Conda activation command for shell ${shellType.name} on (linux)`, async () => {
            const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
            await expectNoCondaActivationCommandForPowershell(false, false, true, pythonPath, shellType.value);
        });

        test(`Conda activation command for shell ${shellType.name} on (mac)`, async () => {
            const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
            await expectNoCondaActivationCommandForPowershell(false, true, false, pythonPath, shellType.value);
        });
    });
    EnumEx.getNamesAndValues(TerminalShellType).forEach(shellType => {
        test(`Conda activation command for shell ${shellType.name} on (windows), containing spaces in environment name`, async () => {
            const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'enva', 'python.exe');
            await expectNoCondaActivationCommandForPowershell(true, false, false, pythonPath, shellType.value, true);
        });

        test(`Conda activation command for shell ${shellType.name} on (linux), containing spaces in environment name`, async () => {
            const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
            await expectNoCondaActivationCommandForPowershell(false, false, true, pythonPath, shellType.value, true);
        });

        test(`Conda activation command for shell ${shellType.name} on (mac), containing spaces in environment name`, async () => {
            const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
            await expectNoCondaActivationCommandForPowershell(false, true, false, pythonPath, shellType.value, true);
        });
    });
    async function expectCondaActivationCommand(isWindows: boolean, isOsx: boolean, isLinux: boolean, pythonPath: string) {
        terminalSettings.setup(t => t.activateEnvironment).returns(() => true);
        platformService.setup(p => p.isLinux).returns(() => isLinux);
        platformService.setup(p => p.isWindows).returns(() => isWindows);
        platformService.setup(p => p.isMac).returns(() => isOsx);
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
        pythonSettings.setup(s => s.pythonPath).returns(() => pythonPath);
        condaService.setup(c => c.getCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve({ name: 'EnvA', path: path.dirname(pythonPath) }));

        const expectedActivationCommand = isWindows ? ['activate EnvA'] : ['source activate EnvA'];
        const activationCommands = await terminalHelper.getEnvironmentActivationCommands(TerminalShellType.bash, undefined);
        expect(activationCommands).to.deep.equal(expectedActivationCommand, 'Incorrect Activation command');
    }

    test('If environment is a conda environment, ensure conda activation command is sent (windows)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'enva', 'python.exe');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(true));
        await expectCondaActivationCommand(true, false, false, pythonPath);
    });

    test('If environment is a conda environment, ensure conda activation command is sent (linux)', async () => {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(true));
        await expectCondaActivationCommand(false, false, true, pythonPath);
    });

    test('If environment is a conda environment, ensure conda activation command is sent (osx)', async () => {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(true));
        await expectCondaActivationCommand(false, true, false, pythonPath);
    });

    test('Get activation script command if environment is not a conda environment', async () => {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        terminalSettings.setup(t => t.activateEnvironment).returns(() => true);
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        pythonSettings.setup(s => s.pythonPath).returns(() => pythonPath);

        const mockProvider = TypeMoq.Mock.ofType<ITerminalActivationCommandProvider>();
        serviceContainer.setup(c => c.getAll(TypeMoq.It.isValue(ITerminalActivationCommandProvider), TypeMoq.It.isAny())).returns(() => [mockProvider.object]);
        mockProvider.setup(p => p.isShellSupported(TypeMoq.It.isAny())).returns(() => true);
        mockProvider.setup(p => p.getActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(['mock command']));

        const expectedActivationCommand = ['mock command'];
        const activationCommands = await terminalHelper.getEnvironmentActivationCommands(TerminalShellType.bash, undefined);
        expect(activationCommands).to.deep.equal(expectedActivationCommand, 'Incorrect Activation command');
    });
    async function expectActivationCommandIfCondaDetectionFails(isWindows: boolean, isOsx: boolean, isLinux: boolean, pythonPath: string, condaEnvsPath: string) {
        terminalSettings.setup(t => t.activateEnvironment).returns(() => true);
        platformService.setup(p => p.isLinux).returns(() => isLinux);
        platformService.setup(p => p.isWindows).returns(() => isWindows);
        platformService.setup(p => p.isMac).returns(() => isOsx);
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        pythonSettings.setup(s => s.pythonPath).returns(() => pythonPath);

        const mockProvider = TypeMoq.Mock.ofType<ITerminalActivationCommandProvider>();
        serviceContainer.setup(c => c.getAll(TypeMoq.It.isValue(ITerminalActivationCommandProvider), TypeMoq.It.isAny())).returns(() => [mockProvider.object]);
        mockProvider.setup(p => p.isShellSupported(TypeMoq.It.isAny())).returns(() => true);
        mockProvider.setup(p => p.getActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(['mock command']));

        const expectedActivationCommand = ['mock command'];
        const activationCommands = await terminalHelper.getEnvironmentActivationCommands(TerminalShellType.bash, undefined);
        expect(activationCommands).to.deep.equal(expectedActivationCommand, 'Incorrect Activation command');
    }

    test('If environment is a conda environment and environment detection fails, ensure activatino of script is sent (windows)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'enva', 'python.exe');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(true));
        await expectActivationCommandIfCondaDetectionFails(true, false, false, pythonPath, condaEnvDir);
    });

    test('If environment is a conda environment and environment detection fails, ensure activatino of script is sent (osx)', async () => {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'python');
        const condaEnvDir = path.join('users', 'xyz', '.conda', 'envs');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(true));
        await expectActivationCommandIfCondaDetectionFails(false, true, false, pythonPath, condaEnvDir);
    });

    test('If environment is a conda environment and environment detection fails, ensure activatino of script is sent (linux)', async () => {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'python');
        const condaEnvDir = path.join('users', 'xyz', '.conda', 'envs');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(true));
        await expectActivationCommandIfCondaDetectionFails(false, false, true, pythonPath, condaEnvDir);
    });

    test('Return undefined if unable to get activation command', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'enva', 'python.exe');

        terminalSettings.setup(t => t.activateEnvironment).returns(() => true);
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));

        pythonSettings.setup(s => s.pythonPath).returns(() => pythonPath);

        const mockProvider = TypeMoq.Mock.ofType<ITerminalActivationCommandProvider>();
        serviceContainer.setup(c => c.getAll(TypeMoq.It.isValue(ITerminalActivationCommandProvider), TypeMoq.It.isAny())).returns(() => [mockProvider.object]);
        mockProvider.setup(p => p.isShellSupported(TypeMoq.It.isAny())).returns(() => true);
        mockProvider.setup(p => p.getActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));

        const activationCommands = await terminalHelper.getEnvironmentActivationCommands(TerminalShellType.bash, undefined);
        expect(activationCommands).to.equal(undefined, 'Incorrect Activation command');
    });
});
