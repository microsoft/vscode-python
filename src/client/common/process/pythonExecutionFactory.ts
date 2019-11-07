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
import { traceError } from '../logger';
import { IConfigurationService, IDisposableRegistry } from '../types';
import { ProcessService } from './proc';
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

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
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
    public async createDaemon(options: DaemonExecutionFactoryCreationOptions): Promise<IPythonDaemonExecutionService> {
        const pythonPath = options.pythonPath ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;
        // Create the python process that will spawn the daemon.
        // Ensure its activated (always).
        const activatedProc = await this.createActivatedEnvironment({ allowEnvironmentFetchExceptions: true, pythonPath: options.pythonPath, resource: options.resource });

        const envPythonPath =
            `${path.join(EXTENSION_ROOT_DIR, 'pythonFiles')}${path.delimiter}${path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python')}`;

        // TODO: Need to merge env variables.
        let envVars = await this.activationHelper.getActivatedEnvironmentVariables(options.resource, undefined , false);
        let env = { PYTHONPATH: envPythonPath, PYTHONUNBUFFERED: '1' };
        envVars = envVars || {};
        if (envVars.PYTHONPATH){
            envVars.PYTHONPATH += path.delimiter + env.PYTHONPATH;
        } else {
            envVars.PYTHONPATH = env.PYTHONPATH;
        }
        envVars.PYTHONUNBUFFERED = '1';
        // tslint:disable-next-line: no-any
        env = envVars as any;
        const daemonProc = activatedProc.execModuleObservable('datascience.daemon', [`--daemon-module=${options.daemonModule}`], { env });
        if (!daemonProc.proc) {
            throw new Error('Failed to create Daemon Proc');
        }
        const connection = createMessageConnection(new StreamMessageReader(daemonProc.proc.stdout), new StreamMessageWriter(daemonProc.proc.stdin));
        connection.listen();
        let stdError = '';
        let procEndEx: Error | undefined;
        daemonProc.proc.stderr.on('data', (d: string | Buffer) => {
            d = typeof d === 'string' ? d : d.toString('utf8');
            stdError += d;
        });
        daemonProc.proc.on('error', ex => procEndEx = ex);

        // Check whether the daemon has started correctly, by sending a ping.
        const data = Date.now().toString();
        type Param = { data: string };
        type Return = { pong: string };
        const request = new RequestType<Param, Return, void, void>('ping');
        try {
            const result = await connection.sendRequest(request, { data });
            if (result.pong !== data) {
                throw new Error('Daemon did not reply correctly to the ping!');
            }
            return new options.daemonClass(activatedProc, pythonPath, daemonProc.proc, connection);
        } catch (ex) {
            traceError('Failed to start the Daemon, StdErr: ', stdError);
            traceError('Failed to start the Daemon, ProcEndEx', procEndEx || ex);
            traceError('Failed to start the Daemon, Ex', ex);
            throw ex;
        }
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
}
