import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem } from '../../../common/platform/types';
import { IProcessService } from '../../../common/process/types';
import { IConfigurationService } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterVersionService, InterpreterType, PythonInterpreter } from '../../contracts';
import { IVirtualEnvironmentManager } from '../../virtualEnvs/types';
import { CacheableLocatorService } from './cacheableLocatorService';

@injectable()
export class CurrentPathService extends CacheableLocatorService {
    private readonly fs: IFileSystem;
    public constructor(@inject(IVirtualEnvironmentManager) private virtualEnvMgr: IVirtualEnvironmentManager,
        @inject(IInterpreterVersionService) private versionProvider: IInterpreterVersionService,
        @inject(IProcessService) private processService: IProcessService,
        @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('CurrentPathService', serviceContainer);
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.suggestionsFromKnownPaths();
    }
    private async suggestionsFromKnownPaths(resource?: Uri) {
        const configSettings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource);
        const currentPythonInterpreter = this.getInterpreter(configSettings.pythonPath, '').then(interpreter => [interpreter]);
        const python = this.getInterpreter('python', '').then(interpreter => [interpreter]);
        const python2 = this.getInterpreter('python2', '').then(interpreter => [interpreter]);
        const python3 = this.getInterpreter('python3', '').then(interpreter => [interpreter]);
        return Promise.all<string[]>([currentPythonInterpreter, python, python2, python3])
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            // tslint:disable-next-line:promise-function-async
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter))));
    }
    private async getInterpreterDetails(interpreter: string): Promise<PythonInterpreter> {
        return Promise.all([
            this.versionProvider.getVersion(interpreter, path.basename(interpreter)),
            this.virtualEnvMgr.getEnvironmentName(interpreter)
        ]).
            then(([displayName, virtualEnvName]) => {
                displayName += virtualEnvName.length > 0 ? ` (${virtualEnvName})` : '';
                return {
                    displayName,
                    path: interpreter,
                    type: virtualEnvName ? InterpreterType.VirtualEnv : InterpreterType.Unknown
                };
            });
    }
    private async getInterpreter(pythonPath: string, defaultValue: string) {
        try {
            const output = await this.processService.exec(pythonPath, ['-c', 'import sys;print(sys.executable)'], {});
            const executablePath = output.stdout.trim();
            if (executablePath.length > 0 && await this.fs.fileExistsAsync(executablePath)) {
                return executablePath;
            }
            return defaultValue;
        } catch {
            return defaultValue;    // Ignore exceptions in getting the executable.
        }
    }
}
