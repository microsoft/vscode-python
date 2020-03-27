import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ConfigurationTarget, Uri, window } from 'vscode';
import { traceError } from '../../common/logger';
import { InterpreterInfomation, IPythonExecutionFactory } from '../../common/process/types';
import { StopWatch } from '../../common/utils/stopWatch';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { PythonInterpreterTelemetry } from '../../telemetry/types';
import { IInterpreterVersionService } from '../contracts';
import { IPythonPathUpdaterServiceFactory, IPythonPathUpdaterServiceManager } from './types';

@injectable()
export class PythonPathUpdaterService implements IPythonPathUpdaterServiceManager {
    private readonly pythonPathSettingsUpdaterFactory: IPythonPathUpdaterServiceFactory;
    private readonly interpreterVersionService: IInterpreterVersionService;
    private readonly executionFactory: IPythonExecutionFactory;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.pythonPathSettingsUpdaterFactory = serviceContainer.get<IPythonPathUpdaterServiceFactory>(
            IPythonPathUpdaterServiceFactory
        );
        this.interpreterVersionService = serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        this.executionFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
    }
    public async updatePythonPath(
        pythonPath: string,
        configTarget: ConfigurationTarget,
        trigger: 'ui' | 'shebang' | 'load',
        wkspace?: Uri
    ): Promise<void> {
        const stopWatch = new StopWatch();
        const pythonPathUpdater = this.getPythonUpdaterService(configTarget, wkspace);
        let failed = false;
        try {
            await pythonPathUpdater.updatePythonPath(path.normalize(pythonPath));
        } catch (reason) {
            failed = true;
            // tslint:disable-next-line:no-unsafe-any prefer-type-cast
            const message = reason && typeof reason.message === 'string' ? (reason.message as string) : '';
            window.showErrorMessage(`Failed to set 'pythonPath'. Error: ${message}`);
            traceError(reason);
        }
        // do not wait for this to complete
        this.sendTelemetry(stopWatch.elapsedTime, failed, trigger, pythonPath).catch((ex) =>
            traceError('Python Extension: sendTelemetry', ex)
        );
    }
    private async sendTelemetry(
        duration: number,
        failed: boolean,
        trigger: 'ui' | 'shebang' | 'load',
        pythonPath: string
    ) {
        const telemtryProperties: PythonInterpreterTelemetry = {
            failed,
            trigger
        };
        if (!failed) {
            const processService = await this.executionFactory.create({ pythonPath });
            const infoPromise = processService
                .getInterpreterInformation()
                .catch<InterpreterInfomation | undefined>(() => undefined);
            const pipVersionPromise = this.interpreterVersionService
                .getPipVersion(pythonPath)
                .then((value) => (value.length === 0 ? undefined : value))
                .catch<string>(() => '');
            const [info, pipVersion] = await Promise.all([infoPromise, pipVersionPromise]);
            if (info && info.version) {
                telemtryProperties.pythonVersion = info.version.raw;
            }
            if (pipVersion) {
                telemtryProperties.pipVersion = pipVersion;
            }
        }
        sendTelemetryEvent(EventName.PYTHON_INTERPRETER, duration, telemtryProperties);
    }
    private getPythonUpdaterService(configTarget: ConfigurationTarget, wkspace?: Uri) {
        switch (configTarget) {
            case ConfigurationTarget.Global: {
                return this.pythonPathSettingsUpdaterFactory.getGlobalPythonPathConfigurationService();
            }
            case ConfigurationTarget.Workspace: {
                if (!wkspace) {
                    throw new Error('Workspace Uri not defined');
                }
                // tslint:disable-next-line:no-non-null-assertion
                return this.pythonPathSettingsUpdaterFactory.getWorkspacePythonPathConfigurationService(wkspace!);
            }
            default: {
                if (!wkspace) {
                    throw new Error('Workspace Uri not defined');
                }
                // tslint:disable-next-line:no-non-null-assertion
                return this.pythonPathSettingsUpdaterFactory.getWorkspaceFolderPythonPathConfigurationService(wkspace!);
            }
        }
    }
}
