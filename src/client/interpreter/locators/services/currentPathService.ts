import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { PythonSettings } from '../../../common/configSettings';
import { IProcessService } from '../../../common/process/types';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterVersionService, InterpreterType, PythonInterpreter } from '../../contracts';
import { IVirtualEnvironmentManager } from '../../virtualEnvs/types';
import { CacheableLocatorService } from './cacheableLocatorService';

@injectable()
export class CurrentPathService extends CacheableLocatorService {
    public constructor(@inject(IVirtualEnvironmentManager) private virtualEnvMgr: IVirtualEnvironmentManager,
        @inject(IInterpreterVersionService) private versionProvider: IInterpreterVersionService,
        @inject(IProcessService) private processService: IProcessService,
        @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('CurrentPathService', serviceContainer);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.suggestionsFromKnownPaths();
    }
    private async suggestionsFromKnownPaths(resource?: Uri) {
        const currentPythonInterpreter = this.getInterpreter(PythonSettings.getInstance(resource).pythonPath, '').then(interpreter => [interpreter]);
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
            this.virtualEnvMgr.detect(interpreter)
        ]).
            then(([displayName, virtualEnv]) => {
                displayName += virtualEnv ? ` (${virtualEnv.name})` : '';
                return {
                    displayName,
                    path: interpreter,
                    type: virtualEnv ? virtualEnv.type : InterpreterType.Unknown
                };
            });
    }
    private async getInterpreter(pythonPath: string, defaultValue: string) {
        return this.processService.exec(pythonPath, ['-c', 'import sys;print(sys.executable)'], {})
            .then(output => output.stdout.trim())
            .then(value => value.length === 0 ? defaultValue : value)
            .catch(() => defaultValue);    // Ignore exceptions in getting the executable.
    }
}
