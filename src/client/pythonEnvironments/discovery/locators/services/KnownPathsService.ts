// tslint:disable:no-require-imports no-var-requires no-unnecessary-callback-wrapper
import { inject, injectable } from 'inversify';

import { Uri } from 'vscode';
import { IFileSystem } from '../../../../common/platform/types';
import { IInterpreterHelper, IKnownSearchPathsForInterpreters } from '../../../../interpreter/contracts';
import { IServiceContainer } from '../../../../ioc/types';
import { EnvironmentType, PythonEnvironment } from '../../../info';
import { lookForInterpretersInDirectory } from '../helpers';
import { CacheableLocatorService } from './cacheableLocatorService';

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
    // tslint:disable-next-line:no-empty
    public dispose() {}

    /**
     * Return the located interpreters.
     *
     * This is used by CacheableLocatorService.getInterpreters().
     */
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
            .then((interpreters) => interpreters.filter(
                (item) => item.length > 0,
            ))
            .then((interpreters) => Promise.all(
                interpreters.map((interpreter) => this.getInterpreterDetails(interpreter)),
            ))
            .then((interpreters) => interpreters.filter(
                (interpreter) => !!interpreter,
            ).map((interpreter) => interpreter!));
    }

    /**
     * Return the information about the identified interpreter binary.
     */
    private async getInterpreterDetails(interpreter: string) {
        const details = await this.helper.getInterpreterInformation(interpreter);
        if (!details) {
            return;
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
            .then((exists) => (exists ? lookForInterpretersInDirectory(dir, fs) : Promise.resolve<string[]>([])));
    }
}
