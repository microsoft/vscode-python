// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { gte } from 'semver';

import { Uri } from 'vscode';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { IComponentAdapter, ICondaService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { CondaEnvironmentInfo } from '../../pythonEnvironments/discovery/locators/services/conda';
import { inDiscoveryExperiment } from '../experiments/helpers';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IFileSystem } from '../platform/types';
import { IConfigurationService, IDisposableRegistry, IExperimentService } from '../types';
import { ProcessService } from './proc';
import { createCondaEnv, createPythonEnv, createWindowsStoreEnv } from './pythonEnvironment';
import { createPythonProcessService } from './pythonProcess';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionFactoryCreationOptions,
    IBufferDecoder,
    IProcessLogger,
    IProcessService,
    IProcessServiceFactory,
    IPythonExecutionFactory,
    IPythonExecutionService,
} from './types';
import { isWindowsStoreInterpreter } from '../../pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';

// Minimum version number of conda required to be able to use 'conda run'
export const CONDA_RUN_VERSION = '4.6.0';

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
    private readonly disposables: IDisposableRegistry;

    private readonly logger: IProcessLogger;

    private readonly fileSystem: IFileSystem;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IEnvironmentActivationService) private readonly activationHelper: IEnvironmentActivationService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(ICondaService) private readonly condaService: ICondaService,
        @inject(IBufferDecoder) private readonly decoder: IBufferDecoder,
        @inject(IComponentAdapter) private readonly pyenvs: IComponentAdapter,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
    ) {
        // Acquire other objects here so that if we are called during dispose they are available.
        this.disposables = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        this.logger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
        this.fileSystem = this.serviceContainer.get<IFileSystem>(IFileSystem);
    }

    public async create(options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.pythonPath
            ? options.pythonPath
            : this.configService.getSettings(options.resource).pythonPath;
        const processService: IProcessService = await this.processServiceFactory.create(options.resource);
        processService.on('exec', this.logger.logProcess.bind(this.logger));

        const windowsStoreInterpreterCheck = (await inDiscoveryExperiment(this.experimentService))
            ? // Class methods may depend on other properties which belong to the class, so bind the correct context.
              this.pyenvs.isWindowsStoreInterpreter.bind(this.pyenvs)
            : isWindowsStoreInterpreter;

        return createPythonService(
            pythonPath,
            processService,
            this.fileSystem,
            undefined,
            await windowsStoreInterpreterCheck(pythonPath),
        );
    }

    public async createActivatedEnvironment(
        options: ExecutionFactoryCreateWithEnvironmentOptions,
    ): Promise<IPythonExecutionService> {
        const envVars = await this.activationHelper.getActivatedEnvironmentVariables(
            options.resource,
            options.interpreter,
            options.allowEnvironmentFetchExceptions,
        );
        const hasEnvVars = envVars && Object.keys(envVars).length > 0;
        sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, undefined, { hasEnvVars });
        if (!hasEnvVars) {
            return this.create({
                resource: options.resource,
                pythonPath: options.interpreter ? options.interpreter.path : undefined,
            });
        }
        const pythonPath = options.interpreter
            ? options.interpreter.path
            : this.configService.getSettings(options.resource).pythonPath;
        const processService: IProcessService = new ProcessService(this.decoder, { ...envVars });
        processService.on('exec', this.logger.logProcess.bind(this.logger));
        this.disposables.push(processService);

        return createPythonService(pythonPath, processService, this.fileSystem);
    }

    // Not using this function for now because there are breaking issues with conda run (conda 4.8, PVSC 2020.1).
    // See https://github.com/microsoft/vscode-python/issues/9490
    public async createCondaExecutionService(
        pythonPath: string,
        processService?: IProcessService,
        resource?: Uri,
    ): Promise<IPythonExecutionService | undefined> {
        const processServicePromise = processService
            ? Promise.resolve(processService)
            : this.processServiceFactory.create(resource);
        const [condaVersion, condaEnvironment, condaFile, procService] = await Promise.all([
            this.condaService.getCondaVersion(),
            this.condaService.getCondaEnvironment(pythonPath),
            this.condaService.getCondaFile(),
            processServicePromise,
        ]);

        if (condaVersion && gte(condaVersion, CONDA_RUN_VERSION) && condaEnvironment && condaFile && procService) {
            // Add logging to the newly created process service
            if (!processService) {
                procService.on('exec', this.logger.logProcess.bind(this.logger));
                this.disposables.push(procService);
            }
            return createPythonService(
                pythonPath,
                procService,
                this.fileSystem,
                // This is what causes a CondaEnvironment to be returned:
                [condaFile, condaEnvironment],
            );
        }

        return Promise.resolve(undefined);
    }
}

function createPythonService(
    pythonPath: string,
    procService: IProcessService,
    fs: IFileSystem,
    conda?: [string, CondaEnvironmentInfo],
    isWindowsStore?: boolean,
): IPythonExecutionService {
    let env = createPythonEnv(pythonPath, procService, fs);
    if (conda) {
        const [condaPath, condaInfo] = conda;
        env = createCondaEnv(condaPath, condaInfo, pythonPath, procService, fs);
    } else if (isWindowsStore) {
        env = createWindowsStoreEnv(pythonPath, procService);
    }
    const procs = createPythonProcessService(procService, env);
    return {
        getInterpreterInformation: () => env.getInterpreterInformation(),
        getExecutablePath: () => env.getExecutablePath(),
        isModuleInstalled: (m) => env.isModuleInstalled(m),
        getModuleVersion: (m) => env.getModuleVersion(m),
        getExecutionInfo: (a) => env.getExecutionInfo(a),
        execObservable: (a, o) => procs.execObservable(a, o),
        execModuleObservable: (m, a, o) => procs.execModuleObservable(m, a, o),
        exec: (a, o) => procs.exec(a, o),
        execModule: (m, a, o) => procs.execModule(m, a, o),
    };
}
