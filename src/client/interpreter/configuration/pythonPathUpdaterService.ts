import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ConfigurationTarget, Uri, window } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { PYTHON_INTERPRETER } from '../../telemetry/constants';
import { StopWatch } from '../../telemetry/stopWatch';
import { PythonInterpreterTelemetry } from '../../telemetry/types';
import { IInterpreterVersionService } from '../contracts';
import { IPythonPathUpdaterServiceFactory, IPythonPathUpdaterServiceManager } from './types';

@injectable()
export class PythonPathUpdaterService implements IPythonPathUpdaterServiceManager {
    private readonly pythonPathSettingsUpdaterFactory: IPythonPathUpdaterServiceFactory;
    private readonly interpreterVersionService: IInterpreterVersionService;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.pythonPathSettingsUpdaterFactory = serviceContainer.get<IPythonPathUpdaterServiceFactory>(IPythonPathUpdaterServiceFactory);
        this.interpreterVersionService = serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
    }
    public async updatePythonPath(pythonPath: string, configTarget: ConfigurationTarget, trigger: 'ui' | 'shebang' | 'load', wkspace?: Uri): Promise<void> {
        const stopWatch = new StopWatch();
        const pythonPathUpdater = this.getPythonUpdaterService(configTarget, wkspace);
        let failed = false;
        try {
            await pythonPathUpdater.updatePythonPath(path.normalize(pythonPath));
        } catch (reason) {
            failed = true;
            // tslint:disable-next-line:no-unsafe-any prefer-type-cast
            const message = reason && typeof reason.message === 'string' ? reason.message as string : '';
            window.showErrorMessage(`Failed to set 'pythonPath'. Error: ${message}`);
            console.error(reason);
        }
        // do not wait for this to complete
        this.sendTelemetry(stopWatch.elapsedTime, failed, trigger, pythonPath)
            .catch(ex => console.error('Python Extension: sendTelemetry', ex));
    }
    private async sendTelemetry(duration: number, failed: boolean, trigger: 'ui' | 'shebang' | 'load', pythonPath: string) {
        const telemtryProperties: PythonInterpreterTelemetry = {
            failed, trigger
        };
        if (!failed) {
            const pyVersionPromise = this.interpreterVersionService.getVersion(pythonPath, '')
                .then(pyVersion => pyVersion.length === 0 ? undefined : pyVersion);
            const pipVersionPromise = this.interpreterVersionService.getPipVersion(pythonPath)
                .then(value => value.length === 0 ? undefined : value)
                .catch(() => undefined);
            const versions = await Promise.all([pyVersionPromise, pipVersionPromise]);
            if (versions[0]) {
                telemtryProperties.version = versions[0] as string;
            }
            if (versions[1]) {
                telemtryProperties.pipVersion = versions[1] as string;
            }
        }
        sendTelemetryEvent(PYTHON_INTERPRETER, duration, telemtryProperties);
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
