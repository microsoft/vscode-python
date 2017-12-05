import * as path from 'path';
import { ConfigurationTarget, Uri, window } from 'vscode';
import { sendTelemetryEvent } from '../../telemetry';
import { PYTHON_INTERPRETER } from '../../telemetry/constants';
import { StopWatch } from '../../telemetry/stopWatch';
import { IInterpreterVersionService } from '../interpreterVersion';
import { IPythonPathUpdaterServiceFactory } from './types';

export class PythonPathUpdaterService {
    constructor(private pythonPathSettingsUpdaterFactory: IPythonPathUpdaterServiceFactory,
        private interpreterVersionService: IInterpreterVersionService) { }
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
        let version: string | undefined;
        let pipVersion: string | undefined;
        if (!failed) {
            const pyVersionPromise = this.interpreterVersionService.getVersion(pythonPath, '')
                .then(pyVersion => pyVersion.length === 0 ? undefined : pyVersion);
            const pipVersionPromise = this.interpreterVersionService.getPipVersion(pythonPath)
                .then(value => value.length === 0 ? undefined : value)
                .catch(() => undefined);
            const versions = await Promise.all([pyVersionPromise, pipVersionPromise]);
            version = versions[0];
            // tslint:disable-next-line:prefer-type-cast
            pipVersion = versions[1] as string;
        }
        sendTelemetryEvent(PYTHON_INTERPRETER, duration, { failed, trigger, version, pipVersion });
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
