// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IProcessServiceFactory } from '../../common/process/types';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../../common/terminal/types';
import { ICurrentProcess, IPathUtils } from '../../common/types';
import { getNamesAndValues } from '../../common/utils/enum';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { InterpreterType, IPipEnvService } from '../contracts';
import { IVirtualEnvironmentManager } from './types';

const PYENVFILES = ['pyvenv.cfg', path.join('..', 'pyvenv.cfg')];

@injectable()
export class VirtualEnvironmentManager implements IVirtualEnvironmentManager {
    private processServiceFactory: IProcessServiceFactory;
    private pipEnvService: IPipEnvService;
    private fs: IFileSystem;
    private pyEnvRoot?: string;
    private workspaceService: IWorkspaceService;
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {
        this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
        this.pipEnvService = serviceContainer.get<IPipEnvService>(IPipEnvService);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }
    public async getEnvironmentName(pythonPath: string, resource?: Uri): Promise<string> {
        const defaultWorkspaceUri = this.workspaceService.hasWorkspaceFolders
            ? this.workspaceService.workspaceFolders![0].uri
            : undefined;
        const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        const workspaceUri = workspaceFolder ? workspaceFolder.uri : defaultWorkspaceUri;
        const grandParentDirName = path.basename(path.dirname(path.dirname(pythonPath)));
        if (workspaceUri && (await this.pipEnvService.isRelatedPipEnvironment(workspaceUri.fsPath, pythonPath))) {
            // In pipenv, return the folder name of the workspace.
            return path.basename(workspaceUri.fsPath);
        }

        return grandParentDirName;
    }
    public async getEnvironmentType(pythonPath: string, resource?: Uri): Promise<InterpreterType> {
        if (await this.isVenvEnvironment(pythonPath)) {
            return InterpreterType.Venv;
        }

        if (await this.isPyEnvEnvironment(pythonPath, resource)) {
            return InterpreterType.Pyenv;
        }

        if (await this.isPipEnvironment(pythonPath, resource)) {
            return InterpreterType.Pipenv;
        }

        if (await this.isVirtualEnvironment(pythonPath)) {
            return InterpreterType.VirtualEnv;
        }

        // Lets not try to determine whether this is a conda environment or not.
        return InterpreterType.Unknown;
    }
    public async isVenvEnvironment(pythonPath: string) {
        const dir = path.dirname(pythonPath);
        const pyEnvCfgFiles = PYENVFILES.map((file) => path.join(dir, file));
        for (const file of pyEnvCfgFiles) {
            if (await this.fs.fileExists(file)) {
                return true;
            }
        }
        return false;
    }
    public async isPyEnvEnvironment(pythonPath: string, resource?: Uri) {
        const pyEnvRoot = await this.getPyEnvRoot(resource);
        return pyEnvRoot && pythonPath.startsWith(pyEnvRoot);
    }
    public async isPipEnvironment(pythonPath: string, resource?: Uri) {
        const defaultWorkspaceUri = this.workspaceService.hasWorkspaceFolders
            ? this.workspaceService.workspaceFolders![0].uri
            : undefined;
        const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        const workspaceUri = workspaceFolder ? workspaceFolder.uri : defaultWorkspaceUri;
        if (workspaceUri && (await this.pipEnvService.isRelatedPipEnvironment(workspaceUri.fsPath, pythonPath))) {
            return true;
        }
        return false;
    }
    public async getPyEnvRoot(resource?: Uri): Promise<string | undefined> {
        if (this.pyEnvRoot) {
            return this.pyEnvRoot;
        }

        const currentProccess = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
        const pyenvRoot = currentProccess.env.PYENV_ROOT;
        if (pyenvRoot) {
            return (this.pyEnvRoot = pyenvRoot);
        }

        try {
            const processService = await this.processServiceFactory.create(resource);
            const output = await processService.exec('pyenv', ['root']);
            if (output.stdout.trim().length > 0) {
                return (this.pyEnvRoot = output.stdout.trim());
            }
        } catch {
            noop();
        }
        const pathUtils = this.serviceContainer.get<IPathUtils>(IPathUtils);
        return (this.pyEnvRoot = path.join(pathUtils.home, '.pyenv'));
    }
    public async isVirtualEnvironment(pythonPath: string) {
        const provider = this.getTerminalActivationProviderForVirtualEnvs();
        const shells = getNamesAndValues<TerminalShellType>(TerminalShellType)
            .filter((shell) => provider.isShellSupported(shell.value))
            .map((shell) => shell.value);

        for (const shell of shells) {
            const cmds = await provider.getActivationCommandsForInterpreter!(pythonPath, shell);
            if (cmds && cmds.length > 0) {
                return true;
            }
        }

        return false;
    }
    private getTerminalActivationProviderForVirtualEnvs(): ITerminalActivationCommandProvider {
        const isWindows = this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows;
        const serviceName = isWindows ? 'commandPromptAndPowerShell' : 'bashCShellFish';
        return this.serviceContainer.get<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            serviceName
        );
    }
}
