// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';

import * as path from 'path';
import { createMessageConnection, RequestType, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { WindowsStoreInterpreter } from '../../interpreter/locators/services/windowsStoreInterpreter';
import { IWindowsStoreInterpreter } from '../../interpreter/locators/types';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { traceDecorators, traceError } from '../logger';
import { IConfigurationService, IDisposableRegistry } from '../types';
import { sleep } from '../utils/async';
import { ProcessService } from './proc';
import { PythonDaemonExecutionService } from './pythonDaemon';
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

// Use 3, as we have one dedicated for use of starting notebooks (long running operations)
// & two for other operations.
const NumberOfDaemonsPerPythonProcess = 3;

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
    private readonly daemonsPerPythonService = new Map<string, Promise<IPythonDaemonExecutionService>>();
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IEnvironmentActivationService) private readonly activationHelper: IEnvironmentActivationService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IBufferDecoder) private readonly decoder: IBufferDecoder,
        @inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter
    ) {}
    public async create(options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.pythonPath ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;
        const processService: IProcessService = await this.processServiceFactory.create(options.resource);
        const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
        processService.on('exec', processLogger.logProcess.bind(processLogger));
        if (this.windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)) {
            return new WindowsStorePythonProcess(this.serviceContainer, processService, pythonPath, this.windowsStoreInterpreter);
        }
        return new PythonExecutionService(this.serviceContainer, processService, pythonPath);
    }
    public async createActivatedEnvironment(options: ExecutionFactoryCreateWithEnvironmentOptions): Promise<IPythonExecutionService> {
        const envVars = await this.activationHelper.getActivatedEnvironmentVariables(options.resource, options.interpreter, options.allowEnvironmentFetchExceptions);
        const hasEnvVars = envVars && Object.keys(envVars).length > 0;
        sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, undefined, { hasEnvVars });
        if (!hasEnvVars) {
            return this.create({ resource: options.resource, pythonPath: options.interpreter ? options.interpreter.path : undefined });
        }
        const pythonPath = options.interpreter ? options.interpreter.path : this.configService.getSettings(options.resource).pythonPath;
        const processService: IProcessService = new ProcessService(this.decoder, { ...envVars });
        const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
        processService.on('exec', processLogger.logProcess.bind(processLogger));
        this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(processService);
        return new PythonExecutionService(this.serviceContainer, processService, pythonPath);
    }
    public async createDaemon(options: DaemonExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.pythonPath ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;
        const daemonPoolKey = `${pythonPath}#${options.daemonClass || ''}#${options.daemonModule || ''}`;
        const disposables = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        const activatedProcPromise = this.createActivatedEnvironment({ allowEnvironmentFetchExceptions: true, pythonPath: options.pythonPath, resource: options.resource });

        const start = async () => {
            const daemons = await this.createDaemonServices(options, activatedProcPromise, NumberOfDaemonsPerPythonProcess);

            const item = new PythonDaemonExecutionServicePool(daemons, await activatedProcPromise);
            disposables.push(item);
            return item;
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
            return activatedProcPromise;
        });
    }
    @traceDecorators.error('Failed to create daemon')
    private async createDaemonServices(
        options: DaemonExecutionFactoryCreationOptions,
        activatedProcPromise: Promise<IPythonExecutionService>,
        numberOfDaemos: number
    ): Promise<IPythonDaemonExecutionService[]> {
        const pythonPath = options.pythonPath ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;

        // Create the python process that will spawn the daemon.
        // Ensure its activated (always).
        const [activatedProc, activatedEnvVars] = await Promise.all([
            activatedProcPromise,
            this.activationHelper.getActivatedEnvironmentVariables(options.resource, undefined, false)
        ]);

        // Setup environment variables for the daemon.
        // The daemon must have access to the Python Module that'll run the daemon
        // & also access to a Python package used for the JSON rpc comms.
        const envPythonPath = `${path.join(EXTENSION_ROOT_DIR, 'pythonFiles')}${path.delimiter}${path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python')}`;
        const env = activatedEnvVars ? { ...activatedEnvVars } : {};
        env.PYTHONPATH = env.PYTHONPATH ? `${env.PYTHONPATH}${path.delimiter}${envPythonPath}` : envPythonPath;
        env.PYTHONUNBUFFERED = '1';

        const loggingArgs = ['-v', `--log-file=/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/daemon${this.daemonsPerPythonService.size}.log`];
        const args = (options.daemonModule ? [`--daemon-module=${options.daemonModule}`] : []).concat(loggingArgs);

        // Create multiple daemons.
        return Promise.all(
            // tslint:disable-next-line: prefer-array-literal
            [...new Array(numberOfDaemos).keys()].map(async () => {
                const daemonProc = activatedProc!.execModuleObservable('datascience.daemon', args, { env });
                if (!daemonProc.proc) {
                    throw new Error('Failed to create Daemon Proc');
                }

                const connection = createMessageConnection(new StreamMessageReader(daemonProc.proc.stdout), new StreamMessageWriter(daemonProc.proc.stdin));
                connection.listen();
                let stdError = '';
                let procEndEx: Error | undefined;
                daemonProc.proc.stderr.on('data', (data: string | Buffer) => {
                    data = typeof data === 'string' ? data : data.toString('utf8');
                    stdError += data;
                });
                daemonProc.proc.on('error', ex => (procEndEx = ex));

                try {
                    // If we don't get a reply to the ping in 5 minutes assume it will never work. Bomb out.
                    // At this point there should be some information logged in stderr of the daemon process.
                    const timeoutedError = sleep(5_000).then(() => Promise.reject(new Error('Timeout waiting for daemon to start')));
                    const request = new RequestType<{ data: string }, { pong: string }, void, void>('ping');
                    // Check whether the daemon has started correctly, by sending a ping.
                    const result = await Promise.race([timeoutedError, connection.sendRequest(request, { data: 'hello' })]);

                    if (result.pong !== 'hello') {
                        throw new Error(`Daemon did not reply to the ping, received: ${result.pong}`);
                    }

                    const cls = options.daemonClass ? options.daemonClass : PythonDaemonExecutionService;
                    return new cls(activatedProc!, pythonPath, daemonProc.proc, connection);
                } catch (ex) {
                    traceError('Failed to start the Daemon, StdErr: ', stdError);
                    traceError('Failed to start the Daemon, ProcEndEx', procEndEx || ex);
                    traceError('Failed  to start the Daemon, Ex', ex);
                    throw ex;
                }
            })
        );
    }
}
