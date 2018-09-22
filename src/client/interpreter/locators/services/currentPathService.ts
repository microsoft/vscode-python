import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { Uri } from 'vscode';
import { IFileSystem } from '../../../common/platform/types';
import { IProcessServiceFactory } from '../../../common/process/types';
import { IConfigurationService } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterHelper, InterpreterType, PythonInterpreter } from '../../contracts';
import { CacheableLocatorService } from './cacheableLocatorService';

/**
 * Locates the currently configured Python interpreter.
 *
 * If no interpreter is configured then it falls back to the system
 * Python (3 then 2).
 */
@injectable()
export class CurrentPathService extends CacheableLocatorService {
    private readonly fs: IFileSystem;

    public constructor(
        @inject(IInterpreterHelper) private helper: IInterpreterHelper,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        super('CurrentPathService', serviceContainer);
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
    }

    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    // tslint:disable-next-line:no-empty
    public dispose() { }

    /**
     * Return the located interpreters.
     *
     * This is used by CacheableLocatorService.getInterpreters().
     */
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.suggestionsFromKnownPaths(resource);
    }

    /**
     * Return the located interpreters.
     */
    private async suggestionsFromKnownPaths(resource?: Uri) {
        const configSettings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource);
        const currentPythonInterpreter = this.getInterpreter(configSettings.pythonPath, '').then(interpreter => [interpreter]);
        const python3 = this.getInterpreter('python3', '').then(interpreter => [interpreter]);
        const python2 = this.getInterpreter('python2', '').then(interpreter => [interpreter]);
        const python = this.getInterpreter('python', '').then(interpreter => [interpreter]);
        return Promise.all<string[]>([currentPythonInterpreter, python3, python2, python])
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            // tslint:disable-next-line:promise-function-async
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter))))
            .then(interpreters => interpreters.filter(item => !!item).map(item => item!));
    }

    /**
     * Return the information about the identified interpreter binary.
     */
    private async getInterpreterDetails(interpreter: string): Promise<PythonInterpreter | undefined> {
        return this.helper.getInterpreterInformation(interpreter)
            .then(details => {
                if (!details) {
                    return;
                }
                return {
                    ...(details as PythonInterpreter),
                    path: interpreter,
                    type: details.type ? details.type : InterpreterType.Unknown
                };
            });
    }

    /**
     * Return the path to the interpreter (or the default if not found).
     */
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
