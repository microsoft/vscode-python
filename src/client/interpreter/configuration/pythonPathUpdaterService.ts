import * as path from 'path';
import { ConfigurationTarget, Uri, window } from 'vscode';
import { WorkspacePythonPath } from '../contracts';
import { IPythonPathUpdaterService, IPythonPathUpdaterServiceFactory } from './types';

export class PythonPathUpdaterService {
    constructor(private pythonPathSettingsUpdaterFactory: IPythonPathUpdaterServiceFactory) { }
    public async updatePythonPath(pythonPath: string, configTarget: ConfigurationTarget, wkspace?: Uri): Promise<void> {
        const pythonPathUpdater = this.getPythonUpdaterService(configTarget, wkspace);

        try {
            await pythonPathUpdater.updatePythonPath(path.normalize(pythonPath));
        } catch (reason) {
            // tslint:disable-next-line:no-unsafe-any prefer-type-cast
            const message = reason && typeof reason.message === 'string' ? reason.message as string : '';
            window.showErrorMessage(`Failed to set 'pythonPath'. Error: ${message}`);
            console.error(reason);
        }
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
