import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { Uri } from 'vscode';
import { IFileSystem } from '../../../common/platform/types';
import { IProcessServiceFactory } from '../../../common/process/types';
import { IConfigurationService } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterHelper, InterpreterType, PythonInterpreter } from '../../contracts';
import { IVirtualEnvironmentManager } from '../../virtualEnvs/types';
import { CacheableLocatorService } from './cacheableLocatorService';

@injectable()
export class CurrentPathService extends CacheableLocatorService {
    private readonly fs: IFileSystem;
    public constructor(@inject(IVirtualEnvironmentManager) private virtualEnvMgr: IVirtualEnvironmentManager,
        @inject(IInterpreterHelper) private helper: IInterpreterHelper,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
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
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter, resource))))
            .then(interpreters => interpreters.filter(item => !!item).map(item => item!));
    }
    private async getInterpreterDetails(interpreter: string, resource?: Uri): Promise<PythonInterpreter | undefined> {
        return Promise.all([
            this.helper.getInterpreterInformation(interpreter),
            this.virtualEnvMgr.getEnvironmentName(interpreter),
            this.virtualEnvMgr.getEnvironmentType(interpreter, resource)
        ]).
            then(([details, virtualEnvName, type]) => {
                if (!details) {
                    return;
                }
                const displayName = `${details.version ? details.version : ''}${virtualEnvName.length > 0 ? ` (${virtualEnvName})` : ''}`;
                return {
                    ...(details as PythonInterpreter),
                    displayName,
                    envName: virtualEnvName,
                    path: interpreter,
                    type: type ? type : InterpreterType.Unknown
                };
            });
    }
    private async getInterpreter(pythonPath: string, defaultValue: string) {
        try {
            const processService = await this.processServiceFactory.create();
            return processService.exec(pythonPath, ['-c', 'import sys;print(sys.executable)'], {})
                .then(output => output.stdout.trim())
                .then(async value => {
                    if (value.length > 0 && await this.fs.fileExists(value)) {
                        return value;
                    }
                    return defaultValue;
                })
                .catch(() => defaultValue);    // Ignore exceptions in getting the executable.
        } catch {
            return defaultValue;    // Ignore exceptions in getting the executable.
        }
    }
}
