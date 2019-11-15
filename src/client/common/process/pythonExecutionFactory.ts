// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
// @ts-ignore
import { gte } from 'semver';
import { Uri } from 'vscode';

import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { ICondaService } from '../../interpreter/contracts';
import { WindowsStoreInterpreter } from '../../interpreter/locators/services/windowsStoreInterpreter';
import { IWindowsStoreInterpreter } from '../../interpreter/locators/types';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { traceError } from '../logger';
import { IConfigurationService, IDisposableRegistry } from '../types';
import { CondaExecutionService } from './condaExecutionService';
import { ProcessService } from './proc';
import { PythonDaemonExecutionServicePool } from './pythonDaemonPool';
import { PythonExecutionService } from './pythonProcess';
import {
    DaemonExecutionFactoryCreationOptions,
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionFactoryCreationOptions,
    IBufferDecoder,
    IProcessLogger,
    IProcessService,
    IProcessServiceFactory,
    IPythonDaemonExecutionService,
    IPythonExecutionFactory,
    IPythonExecutionService
} from './types';
import { WindowsStorePythonProcess } from './windowsStorePythonProcess';

// Minimum version number of conda required to be able to use 'conda run'
export const CONDA_RUN_VERSION = '4.6.0';

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
    private readonly daemonsPerPythonService = new Map<string, Promise<IPythonDaemonExecutionService>>();
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IEnvironmentActivationService) private readonly activationHelper: IEnvironmentActivationService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        // @ts-ignore
        @inject(ICondaService) private readonly condaService: ICondaService,
        @inject(IBufferDecoder) private readonly decoder: IBufferDecoder,
        @inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter
    ) {}
    public async create(options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.pythonPath ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;
        const processService: IProcessService = await this.processServiceFactory.create(options.resource);
        const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
        processService.on('exec', processLogger.logProcess.bind(processLogger));

        const condaExecutionService = await this.createCondaExecutionService(pythonPath, processService);
        if (condaExecutionService) {
            return condaExecutionService;
        }

        if (this.windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)) {
            return new WindowsStorePythonProcess(this.serviceContainer, processService, pythonPath, this.windowsStoreInterpreter);
        }
        return new PythonExecutionService(this.serviceContainer, processService, pythonPath);
    }
    public async createDaemon(options: DaemonExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.pythonPath ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;
        const daemonPoolKey = `${pythonPath}#${options.daemonClass || ''}#${options.daemonModule || ''}`;
        const disposables = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        const activatedProcPromise = this.createActivatedEnvironment({ allowEnvironmentFetchExceptions: true, pythonPath: options.pythonPath, resource: options.resource });

        // Ensure we do not start multiple daemons for the same interpreter.
        // Cache the promise.
        const start = async () => {
            const [activatedProc, activatedEnvVars] = await Promise.all([
                activatedProcPromise,
                this.activationHelper.getActivatedEnvironmentVariables(options.resource, undefined, false)
            ]);

            const daemon = new PythonDaemonExecutionServicePool({ ...options, pythonPath }, activatedProc!, activatedEnvVars);
            await daemon.initialize();
            disposables.push(daemon);
            return daemon;
        };

        // Ensure we do not create muliple daemon pools for the same python interpreter.
        let promise = this.daemonsPerPythonService.get(daemonPoolKey);
        if (!promise) {
            promise = start();
            this.daemonsPerPythonService.set(daemonPoolKey, promise);
        }
        return promise.catch(ex => {
            // Ok, we failed to create the daemon (or failed to start).
            // What ever the cause, we need to log this & give a standard IPythonExecutionService
            traceError('Failed to create the daemon service, defaulting to activated environment', ex);
            this.daemonsPerPythonService.delete(daemonPoolKey);
            return activatedProcPromise;
        });
    }
    public async createActivatedEnvironment(options: ExecutionFactoryCreateWithEnvironmentOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.interpreter ? options.interpreter.path : this.configService.getSettings(options.resource).pythonPath;
        const condaExecutionService = await this.createCondaExecutionService(pythonPath, undefined, options.resource);
        if (condaExecutionService) {
            return condaExecutionService;
        }

        const envVars = await this.activationHelper.getActivatedEnvironmentVariables(options.resource, options.interpreter, options.allowEnvironmentFetchExceptions);
        const hasEnvVars = envVars && Object.keys(envVars).length > 0;
        sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, undefined, { hasEnvVars });
        if (!hasEnvVars) {
            return this.create({ resource: options.resource, pythonPath: options.interpreter ? options.interpreter.path : undefined });
        }
        const processService: IProcessService = new ProcessService(this.decoder, { ...envVars });
        const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
        processService.on('exec', processLogger.logProcess.bind(processLogger));
        this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(processService);
        return new PythonExecutionService(this.serviceContainer, processService, pythonPath);
    }

    public async createCondaExecutionService(pythonPath: string, processService?: IProcessService, resource?: Uri): Promise<CondaExecutionService | undefined> {
        if (await this.condaService.isCondaEnvironment(pythonPath)) {
            const processServicePromise = processService ? Promise.resolve(processService) : this.processServiceFactory.create(resource);
            const [condaVersion, condaEnvironment, condaFile, procService] = await Promise.all([
                this.condaService.getCondaVersion(),
                this.condaService.getCondaEnvironment(pythonPath),
                this.condaService.getCondaFile(),
                processServicePromise
            ]);

            if (condaVersion && gte(condaVersion, CONDA_RUN_VERSION) && condaEnvironment && condaFile && procService) {
                // Add logging to the newly created process service
                if (!processService) {
                    const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
                    procService.on('exec', processLogger.logProcess.bind(processLogger));
                    this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(procService);
                }
                return new CondaExecutionService(this.serviceContainer, procService, pythonPath, condaFile, condaEnvironment);
            }
        }

        return undefined;
    }
}
