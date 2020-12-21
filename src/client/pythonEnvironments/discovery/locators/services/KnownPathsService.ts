/* eslint-disable max-classes-per-file */

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem, IPlatformService } from '../../../../common/platform/types';
import { ICurrentProcess, IPathUtils } from '../../../../common/types';
import { IInterpreterHelper, IKnownSearchPathsForInterpreters } from '../../../../interpreter/contracts';
import { IServiceContainer } from '../../../../ioc/types';
import { EnvironmentType, PythonEnvironment } from '../../../info';
import { lookForInterpretersInDirectory } from '../helpers';
import { CacheableLocatorService } from './cacheableLocatorService';

// eslint-disable-next-line global-require
const flatten = require('lodash/flatten') as typeof import('lodash/flatten');

/**
 * Locates "known" paths.
 */
@injectable()
export class KnownPathsService extends CacheableLocatorService {
    public constructor(
        @inject(IKnownSearchPathsForInterpreters) private knownSearchPaths: IKnownSearchPathsForInterpreters,
        @inject(IInterpreterHelper) private helper: IInterpreterHelper,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
    ) {
        super('KnownPathsService', serviceContainer);
    }

    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */

    // eslint-disable-next-line
    public dispose(): void {
        // No body
    }

    /**
     * Return the located interpreters.
     *
     * This is used by CacheableLocatorService.getInterpreters().
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected getInterpretersImplementation(_resource?: Uri): Promise<PythonEnvironment[]> {
        return this.suggestionsFromKnownPaths();
    }

    /**
     * Return the located interpreters.
     */
    private suggestionsFromKnownPaths() {
        const promises = this.knownSearchPaths.getSearchPaths().map((dir) => this.getInterpretersInDirectory(dir));
        return Promise.all<string[]>(promises)
            .then((listOfInterpreters) => flatten(listOfInterpreters))
            .then((interpreters) => interpreters.filter((item) => item.length > 0))
            .then((interpreters) =>
                Promise.all(interpreters.map((interpreter) => this.getInterpreterDetails(interpreter))),
            )
            .then((interpreters) =>
                interpreters.filter((interpreter) => !!interpreter).map((interpreter) => interpreter!),
            );
    }

    /**
     * Return the information about the identified interpreter binary.
     */
    private async getInterpreterDetails(interpreter: string) {
        const details = await this.helper.getInterpreterInformation(interpreter);
        if (!details) {
            return undefined;
        }
        this._hasInterpreters.resolve(true);
        return {
            ...(details as PythonEnvironment),
            path: interpreter,
            envType: EnvironmentType.Unknown,
        };
    }

    /**
     * Return the interpreters in the given directory.
     */
    private getInterpretersInDirectory(dir: string) {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        return fs
            .directoryExists(dir)
            .then((exists) => (exists ? lookForInterpretersInDirectory(dir) : Promise.resolve<string[]>([])));
    }
}

@injectable()
export class KnownSearchPathsForInterpreters implements IKnownSearchPathsForInterpreters {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {}

    /**
     * Return the paths where Python interpreters might be found.
     */
    public getSearchPaths(): string[] {
        const currentProcess = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
        const platformService = this.serviceContainer.get<IPlatformService>(IPlatformService);
        const pathUtils = this.serviceContainer.get<IPathUtils>(IPathUtils);

        const searchPaths = currentProcess.env[platformService.pathVariableName]!.split(pathUtils.delimiter)
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

        if (!platformService.isWindows) {
            ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin'].forEach((p) => {
                searchPaths.push(p);
                searchPaths.push(path.join(pathUtils.home, p));
            });
            // Add support for paths such as /Users/xxx/anaconda/bin.
            if (process.env.HOME) {
                searchPaths.push(path.join(pathUtils.home, 'anaconda', 'bin'));
                searchPaths.push(path.join(pathUtils.home, 'python', 'bin'));
            }
        }
        return searchPaths;
    }
}
