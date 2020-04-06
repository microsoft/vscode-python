// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { gte } from 'semver';

import { Uri } from 'vscode';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { CondaEnvironmentInfo, ICondaService, IInterpreterService } from '../../interpreter/contracts';
import { WindowsStoreInterpreter } from '../../interpreter/locators/services/windowsStoreInterpreter';
import { IWindowsStoreInterpreter } from '../../interpreter/locators/types';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { traceError } from '../logger';
import { IFileSystem } from '../platform/types';
import { IConfigurationService, IDisposableRegistry } from '../types';
import { ProcessService } from './proc';
import { PythonDaemonExecutionServicePool } from './pythonDaemonPool';
import { createCondaEnv, createPythonEnv, createWindowsStoreEnv } from './pythonEnvironment';
import { createPythonProcessService } from './pythonProcess';
import {
    DaemonExecutionFactoryCreationOptions,
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionFactoryCreationOptions,
    ExecutionResult,
    IBufferDecoder,
    InterpreterInfomation,
    IProcessLogger,
    IProcessService,
    IProcessServiceFactory,
    IPythonDaemonExecutionService,
    IPythonExecutionFactory,
    IPythonExecutionService,
    ObservableExecutionResult,
    PythonExecutionInfo,
    SpawnOptions
} from './types';

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
        @inject(ICondaService) private readonly condaService: ICondaService,
        @inject(IBufferDecoder) private readonly decoder: IBufferDecoder,
        @inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter
    ) {}
    public async create(options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.pythonPath
            ? options.pythonPath
            : this.configService.getSettings(options.resource).pythonPath;
        const processService: IProcessService = await this.processServiceFactory.create(options.resource);
        const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
        processService.on('exec', processLogger.logProcess.bind(processLogger));

        return createPythonService(
            pythonPath,
            processService,
            this.serviceContainer.get<IFileSystem>(IFileSystem),
            undefined,
            this.windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)
        );
    }

    public async createDaemon(options: DaemonExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.pythonPath
            ? options.pythonPath
            : this.configService.getSettings(options.resource).pythonPath;
        const daemonPoolKey = `${pythonPath}#${options.daemonClass || ''}#${options.daemonModule || ''}`;
        const disposables = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const logger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);

        const interpreter = await interpreterService.getInterpreterDetails(pythonPath);
        const activatedProcPromise = this.createActivatedEnvironment({
            allowEnvironmentFetchExceptions: true,
            interpreter: interpreter,
            resource: options.resource,
            bypassCondaExecution: true
        });
        // No daemon support in Python 2.7.
        if (interpreter?.version && interpreter.version.major < 3) {
            return activatedProcPromise!;
        }

        // Ensure we do not start multiple daemons for the same interpreter.
        // Cache the promise.
        const start = async () => {
            const [activatedProc, activatedEnvVars] = await Promise.all([
                activatedProcPromise,
                this.activationHelper.getActivatedEnvironmentVariables(options.resource, interpreter, true)
            ]);

            const daemon = new PythonDaemonExecutionServicePool(
                logger,
                disposables,
                { ...options, pythonPath },
                activatedProc!,
                activatedEnvVars
            );
            await daemon.initialize();
            disposables.push(daemon);
            return daemon;
        };

        // Ensure we do not create multiple daemon pools for the same python interpreter.
        let promise = this.daemonsPerPythonService.get(daemonPoolKey);
        if (!promise) {
            promise = start();
            this.daemonsPerPythonService.set(daemonPoolKey, promise);
        }
        return promise.catch((ex) => {
            // Ok, we failed to create the daemon (or failed to start).
            // What ever the cause, we need to log this & give a standard IPythonExecutionService
            traceError('Failed to create the daemon service, defaulting to activated environment', ex);
            this.daemonsPerPythonService.delete(daemonPoolKey);
            return activatedProcPromise;
        });
    }
    public async createActivatedEnvironment(
        options: ExecutionFactoryCreateWithEnvironmentOptions
    ): Promise<IPythonExecutionService> {
        const envVars = await this.activationHelper.getActivatedEnvironmentVariables(
            options.resource,
            options.interpreter,
            options.allowEnvironmentFetchExceptions
        );
        const hasEnvVars = envVars && Object.keys(envVars).length > 0;
        sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, undefined, { hasEnvVars });
        if (!hasEnvVars) {
            return this.create({
                resource: options.resource,
                pythonPath: options.interpreter ? options.interpreter.path : undefined
            });
        }
        const pythonPath = options.interpreter
            ? options.interpreter.path
            : this.configService.getSettings(options.resource).pythonPath;
        const processService: IProcessService = new ProcessService(this.decoder, { ...envVars });
        const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
        processService.on('exec', processLogger.logProcess.bind(processLogger));
        this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(processService);

        return createPythonService(pythonPath, processService, this.serviceContainer.get<IFileSystem>(IFileSystem));
    }
    // Not using this function for now because there are breaking issues with conda run (conda 4.8, PVSC 2020.1).
    // See https://github.com/microsoft/vscode-python/issues/9490
    public async createCondaExecutionService(
        pythonPath: string,
        processService?: IProcessService,
        resource?: Uri
    ): Promise<PythonExecutionService | undefined> {
        const processServicePromise = processService
            ? Promise.resolve(processService)
            : this.processServiceFactory.create(resource);
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
            return createPythonService(
                pythonPath,
                procService,
                this.serviceContainer.get<IFileSystem>(IFileSystem),
                // This is what causes a CondaEnvironment to be returned:
                [condaFile, condaEnvironment]
            );
        }

        return Promise.resolve(undefined);
    }
}

class PythonExecutionService implements IPythonExecutionService {
    constructor(
        // These are composed by the caller.
        private readonly env: {
            getInterpreterInformation(): Promise<InterpreterInfomation | undefined>;
            getExecutablePath(): Promise<string>;
            isModuleInstalled(name: string): Promise<boolean>;
            getExecutionInfo(pythonArgs?: string[]): PythonExecutionInfo;
        },
        private readonly procs: {
            execObservable(args: string[], opts: SpawnOptions): ObservableExecutionResult<string>;
            execModuleObservable(name: string, args: string[], opts: SpawnOptions): ObservableExecutionResult<string>;
            exec(args: string[], opts: SpawnOptions): Promise<ExecutionResult<string>>;
            execModule(name: string, args: string[], opts: SpawnOptions): Promise<ExecutionResult<string>>;
        }
    ) {}

    // env info wrappers
    public async getInterpreterInformation(): Promise<InterpreterInfomation | undefined> {
        return this.env.getInterpreterInformation();
    }
    public async getExecutablePath(): Promise<string> {
        return this.env.getExecutablePath();
    }
    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        return this.env.isModuleInstalled(moduleName);
    }
    public getExecutionInfo(pythonArgs?: string[]): PythonExecutionInfo {
        return this.env.getExecutionInfo(pythonArgs);
    }

    // proc wrappers
    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        return this.procs.execObservable(args, options);
    }
    public execModuleObservable(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): ObservableExecutionResult<string> {
        return this.procs.execModuleObservable(moduleName, args, options);
    }
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        return this.procs.exec(args, options);
    }
    public async execModule(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): Promise<ExecutionResult<string>> {
        return this.procs.execModule(moduleName, args, options);
    }
}

function createPythonService(
    pythonPath: string,
    procService: IProcessService,
    fs: IFileSystem,
    conda?: [string, CondaEnvironmentInfo],
    isWindowsStore?: boolean
): PythonExecutionService {
    let env = createPythonEnv(pythonPath, procService, fs);
    if (conda) {
        const [condaPath, condaInfo] = conda;
        env = createCondaEnv(condaPath, condaInfo, pythonPath, procService, fs);
    } else if (isWindowsStore) {
        env = createWindowsStoreEnv(pythonPath, procService);
    }
    const procs = createPythonProcessService(procService, env);
    return new PythonExecutionService(env, procs);
}

export namespace _forTestingUseOnly {
    export function createPyService(
        python: string,
        procs: IProcessService,
        fs: IFileSystem,
        conda?: [string, CondaEnvironmentInfo],
        isWinStore?: boolean
    ) {
        return createPythonService(python, procs, fs, conda, isWinStore);
    }
}
