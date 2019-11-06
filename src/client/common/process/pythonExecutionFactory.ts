// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';

import {createMessageConnection, RequestType, StreamMessageReader, StreamMessageWriter} from 'vscode-jsonrpc';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { WindowsStoreInterpreter } from '../../interpreter/locators/services/windowsStoreInterpreter';
import { IWindowsStoreInterpreter } from '../../interpreter/locators/types';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IConfigurationService, IDisposableRegistry } from '../types';
import { ProcessService } from './proc';
import { PythonDaemonExecutionService } from './pythonDaemon';
import { PythonExecutionService } from './pythonProcess';
import {
    DaemonExecutionFactoryCreationOptions,
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionFactoryCreationOptions,
    IBufferDecoder,
    IProcessLogger,
    IProcessService,
    IProcessServiceFactory,
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
    public async createDaemon(options:  DaemonExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        // Create the python process that will spawn the daemon.
        // Ensure its activated (always).
        const activatedProc = await this.createActivatedEnvironment({allowEnvironmentFetchExceptions: true, pythonPath: options.pythonPath, resource: options.resource});
        const envPythonPath = '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/pythonFiles:/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/pythonFiles/lib/python';
        const env = {PYTHONPATH: envPythonPath, PYTHONUNBUFFERED: '1'};
        const daemonProc = activatedProc.execObservable([options.daemonPythonFile], {env});
        if (!daemonProc.proc){
            throw new Error('Failed to create Daemon Proc');
        }
        const connection = createMessageConnection(new StreamMessageReader(daemonProc.proc.stdout), new StreamMessageWriter(daemonProc.proc.stdin));
        const data = Date.now().toString();
        type Param = {data: string};
        type Return = {pong: string};
        const request = new RequestType<Param, Return, void, void>('ping');
        const result = await connection.sendRequest(request, {data});
        if (result.pong !== data){
            throw new Error('Daemon did not reply correctly to the ping!');
        }
        const pythonPath = options.pythonPath ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;
        return new PythonDaemonExecutionService(activatedProc, pytonPath, daemonProc, connection);
    }
    public async createActivatedEnvironment(options: ExecutionFactoryCreateWithEnvironmentOptions): Promise<IPythonExecutionService> {
        const envVars = await this.activationHelper.getActivatedEnvironmentVariables(options.resource, options.interpreter, options.allowEnvironmentFetchExceptions);
        const hasEnvVars = envVars && Object.keys(envVars).length > 0;
        sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, undefined, { hasEnvVars });
        const pythonPath = options.interpreter ? options.interpreter.path : (options.pythonPath ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath);
        if (!hasEnvVars) {
            return this.create({ resource: options.resource, pythonPath });
        }
        const processService: IProcessService = new ProcessService(this.decoder, { ...envVars });
        const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
        processService.on('exec', processLogger.logProcess.bind(processLogger));
        this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(processService);
        return new PythonExecutionService(this.serviceContainer, processService, pythonPath);
    }
}
