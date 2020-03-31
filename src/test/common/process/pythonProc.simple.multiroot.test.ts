// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { execFile } from 'child_process';
import * as fs from 'fs-extra';
import { Container } from 'inversify';
import { EOL } from 'os';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import { ConfigurationTarget, Disposable, Memento, OutputChannel, Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { STANDARD_OUTPUT_CHANNEL } from '../../../client/common/constants';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { IS_WINDOWS } from '../../../client/common/platform/constants';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { PathUtils } from '../../../client/common/platform/pathUtils';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { CurrentProcess } from '../../../client/common/process/currentProcess';
import { ProcessLogger } from '../../../client/common/process/logger';
import { registerTypes as processRegisterTypes } from '../../../client/common/process/serviceRegistry';
import { IProcessLogger, IPythonExecutionFactory, StdErrError } from '../../../client/common/process/types';
import {
    GLOBAL_MEMENTO,
    IConfigurationService,
    ICurrentProcess,
    IDisposableRegistry,
    IMemento,
    IOutputChannel,
    IPathUtils,
    IPersistentStateFactory,
    IsWindows,
    WORKSPACE_MEMENTO
} from '../../../client/common/types';
import { clearCache } from '../../../client/common/utils/cacheUtils';
import { OSType } from '../../../client/common/utils/platform';
import { registerTypes as variablesRegisterTypes } from '../../../client/common/variables/serviceRegistry';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import {
    IInterpreterAutoSelectionService,
    IInterpreterAutoSeletionProxyService
} from '../../../client/interpreter/autoSelection/types';
import { ICondaService, IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { CondaService } from '../../../client/interpreter/locators/services/condaService';
import { InterpreterHashProvider } from '../../../client/interpreter/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../../../client/interpreter/locators/services/hashProviderFactory';
import { InterpreterFilter } from '../../../client/interpreter/locators/services/interpreterFilter';
import { WindowsStoreInterpreter } from '../../../client/interpreter/locators/services/windowsStoreInterpreter';
import { ServiceContainer } from '../../../client/ioc/container';
import { ServiceManager } from '../../../client/ioc/serviceManager';
import { IServiceContainer } from '../../../client/ioc/types';
import { clearPythonPathInWorkspaceFolder, getExtensionSettings, isOs, isPythonVersion } from '../../common';
import { MockOutputChannel } from '../../mockClasses';
import { MockAutoSelectionService } from '../../mocks/autoSelector';
import { MockMemento } from '../../mocks/mementos';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

use(chaiAsPromised);

const multirootPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc');
const workspace4Path = Uri.file(path.join(multirootPath, 'workspace4'));
const workspace4PyFile = Uri.file(path.join(workspace4Path.fsPath, 'one.py'));

// tslint:disable-next-line:max-func-body-length
suite('PythonExecutableService', () => {
    let cont: Container;
    let serviceContainer: IServiceContainer;
    let configService: IConfigurationService;
    let pythonExecFactory: IPythonExecutionFactory;

    suiteSetup(async function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await clearPythonPathInWorkspaceFolder(workspace4Path);
        await initialize();
    });
    setup(async () => {
        cont = new Container();
        serviceContainer = new ServiceContainer(cont);
        const serviceManager = new ServiceManager(cont);

        serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);
        serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, []);
        serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);
        const standardOutputChannel = new MockOutputChannel('Python');
        serviceManager.addSingletonInstance<OutputChannel>(
            IOutputChannel,
            standardOutputChannel,
            STANDARD_OUTPUT_CHANNEL
        );
        serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);
        serviceManager.addSingleton<IConfigurationService>(IConfigurationService, ConfigurationService);
        serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
        serviceManager.addSingleton<IWorkspaceService>(IWorkspaceService, WorkspaceService);
        serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
        serviceManager.addSingleton<IProcessLogger>(IProcessLogger, ProcessLogger);
        serviceManager.addSingleton<IInterpreterAutoSelectionService>(
            IInterpreterAutoSelectionService,
            MockAutoSelectionService
        );
        serviceManager.addSingleton<IInterpreterAutoSeletionProxyService>(
            IInterpreterAutoSeletionProxyService,
            MockAutoSelectionService
        );
        serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter);
        serviceManager.addSingleton<InterpreterHashProvider>(InterpreterHashProvider, InterpreterHashProvider);
        serviceManager.addSingleton<InterpeterHashProviderFactory>(
            InterpeterHashProviderFactory,
            InterpeterHashProviderFactory
        );
        serviceManager.addSingleton<InterpreterFilter>(InterpreterFilter, InterpreterFilter);
        serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
        serviceManager.addSingleton<Memento>(IMemento, MockMemento, GLOBAL_MEMENTO);
        serviceManager.addSingleton<Memento>(IMemento, MockMemento, WORKSPACE_MEMENTO);

        serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);

        processRegisterTypes(serviceManager);
        variablesRegisterTypes(serviceManager);

        const mockInterpreterService = mock(InterpreterService);
        when(mockInterpreterService.hasInterpreters).thenResolve(false);
        serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, instance(mockInterpreterService));

        const mockEnvironmentActivationService = mock(EnvironmentActivationService);
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything(), anything())).thenResolve();
        when(
            mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything(), anything(), anything())
        ).thenResolve();
        serviceManager.addSingletonInstance<IEnvironmentActivationService>(
            IEnvironmentActivationService,
            instance(mockEnvironmentActivationService)
        );

        configService = serviceManager.get<IConfigurationService>(IConfigurationService);
        pythonExecFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);

        await configService.updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        clearCache();
        return initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        cont.unbindAll();
        cont.unload();
        await closeActiveWindows();
        await clearPythonPathInWorkspaceFolder(workspace4Path);
        await configService.updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        await initializeTest();
        clearCache();
    });

    test('Importing without a valid PYTHONPATH should fail', async () => {
        await configService.updateSetting(
            'envFile',
            'someInvalidFile.env',
            workspace4PyFile,
            ConfigurationTarget.WorkspaceFolder
        );
        pythonExecFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecService = await pythonExecFactory.create({ resource: workspace4PyFile });
        const promise = pythonExecService.exec([workspace4PyFile.fsPath], {
            cwd: path.dirname(workspace4PyFile.fsPath),
            throwOnStdErr: true
        });

        await expect(promise).to.eventually.be.rejectedWith(StdErrError);
    });

    test('Importing with a valid PYTHONPATH from .env file should succeed', async function () {
        // This test has not been working for many months in Python 2.7 under
        // Windows. Tracked by #2547.
        if (isOs(OSType.Windows) && (await isPythonVersion('2.7'))) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }

        await configService.updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const pythonExecService = await pythonExecFactory.create({ resource: workspace4PyFile });
        const promise = pythonExecService.exec([workspace4PyFile.fsPath], {
            cwd: path.dirname(workspace4PyFile.fsPath),
            throwOnStdErr: true
        });

        await expect(promise).to.eventually.have.property('stdout', `Hello${EOL}`);
    });

    test("Known modules such as 'os' and 'sys' should be deemed 'installed'", async () => {
        const pythonExecService = await pythonExecFactory.create({ resource: workspace4PyFile });
        const osModuleIsInstalled = pythonExecService.isModuleInstalled('os');
        const sysModuleIsInstalled = pythonExecService.isModuleInstalled('sys');
        await expect(osModuleIsInstalled).to.eventually.equal(true, 'os module is not installed');
        await expect(sysModuleIsInstalled).to.eventually.equal(true, 'sys module is not installed');
    });

    test("Unknown modules such as 'xyzabc123' be deemed 'not installed'", async () => {
        const pythonExecService = await pythonExecFactory.create({ resource: workspace4PyFile });
        const randomModuleName = `xyz123${new Date().getSeconds()}`;
        const randomModuleIsInstalled = pythonExecService.isModuleInstalled(randomModuleName);
        await expect(randomModuleIsInstalled).to.eventually.equal(
            false,
            `Random module '${randomModuleName}' is installed`
        );
    });

    test('Ensure correct path to executable is returned', async () => {
        const pythonPath = getExtensionSettings(workspace4Path).pythonPath;
        let expectedExecutablePath: string;
        if (await fs.pathExists(pythonPath)) {
            expectedExecutablePath = pythonPath;
        } else {
            expectedExecutablePath = await new Promise<string>((resolve) => {
                execFile(pythonPath, ['-c', 'import sys;print(sys.executable)'], (_error, stdout, _stdErr) => {
                    resolve(stdout.trim());
                });
            });
        }
        const pythonExecService = await pythonExecFactory.create({ resource: workspace4PyFile });
        const executablePath = await pythonExecService.getExecutablePath();
        expect(executablePath).to.equal(expectedExecutablePath, 'Executable paths are not the same');
    });
});
