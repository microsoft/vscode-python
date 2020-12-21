// tslint:disable:no-unnecessary-callback-wrapper no-require-imports no-var-requires

import { injectable, unmanaged } from 'inversify';
import { flatten, noop } from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { traceError } from '../../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../../common/platform/types';
import { IInterpreterHelper, IVirtualEnvironmentsSearchPathProvider } from '../../../../interpreter/contracts';
import { IVirtualEnvironmentManager } from '../../../../interpreter/virtualEnvs/types';
import { IServiceContainer } from '../../../../ioc/types';
import { EnvironmentType, PythonEnvironment } from '../../../info';
import { lookForInterpretersInDirectory } from '../helpers';
import { CacheableLocatorService } from './cacheableLocatorService';

@injectable()
export class BaseVirtualEnvService extends CacheableLocatorService {
    private readonly virtualEnvMgr: IVirtualEnvironmentManager;

    private readonly helper: IInterpreterHelper;

    private readonly fileSystem: IFileSystem;

    public constructor(
        @unmanaged() private searchPathsProvider: IVirtualEnvironmentsSearchPathProvider,
        @unmanaged() serviceContainer: IServiceContainer,
        @unmanaged() name: string,
        @unmanaged() cachePerWorkspace = false,
    ) {
        super(name, serviceContainer, cachePerWorkspace);
        this.virtualEnvMgr = serviceContainer.get<IVirtualEnvironmentManager>(IVirtualEnvironmentManager);
        this.helper = serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
    }

    // eslint-disable-next-line class-methods-use-this
    public dispose(): void {
        noop();
    }

    protected getInterpretersImplementation(resource?: Uri): Promise<PythonEnvironment[]> {
        return this.suggestionsFromKnownVenvs(resource);
    }

    private async suggestionsFromKnownVenvs(resource?: Uri) {
        const searchPaths = await this.searchPathsProvider.getSearchPaths(resource);
        return Promise.all(
            searchPaths.map((dir) => this.lookForInterpretersInVenvs(dir, resource)),
        ).then((listOfInterpreters) => flatten(listOfInterpreters));
    }

    private async lookForInterpretersInVenvs(pathToCheck: string, resource?: Uri) {
        return this.fileSystem
            .getSubDirectories(pathToCheck)
            .then((subDirs) => Promise.all(this.getProspectiveDirectoriesForLookup(subDirs)))
            .then((dirs) => dirs.filter((dir) => dir.length > 0))
            .then((dirs) => Promise.all(dirs.map((d) => lookForInterpretersInDirectory(d))))
            .then((pathsWithInterpreters) => flatten(pathsWithInterpreters))
            .then((interpreters) =>
                Promise.all(interpreters.map((interpreter) => this.getVirtualEnvDetails(interpreter, resource))),
            )
            .then((interpreters) =>
                interpreters.filter((interpreter) => !!interpreter).map((interpreter) => interpreter!),
            ) // NOSONAR
            .catch((err) => {
                traceError('Python Extension (lookForInterpretersInVenvs):', err);
                // Ignore exceptions.
                return [] as PythonEnvironment[];
            });
    }

    private getProspectiveDirectoriesForLookup(subDirs: string[]) {
        const platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
        const dirToLookFor = platform.virtualEnvBinName;
        return subDirs.map((subDir) =>
            this.fileSystem
                .getSubDirectories(subDir)
                .then((dirs) => {
                    const scriptOrBinDirs = dirs.filter((dir) => {
                        const folderName = path.basename(dir);
                        return this.fileSystem.arePathsSame(folderName, dirToLookFor);
                    });
                    return scriptOrBinDirs.length === 1 ? scriptOrBinDirs[0] : '';
                })
                .catch((err) => {
                    traceError('Python Extension (getProspectiveDirectoriesForLookup):', err);
                    // Ignore exceptions.
                    return '';
                }),
        );
    }

    private async getVirtualEnvDetails(interpreter: string, resource?: Uri): Promise<PythonEnvironment | undefined> {
        return Promise.all([
            this.helper.getInterpreterInformation(interpreter),
            this.virtualEnvMgr.getEnvironmentName(interpreter, resource),
            this.virtualEnvMgr.getEnvironmentType(interpreter, resource),
        ]).then(
            ([details, virtualEnvName, type]): Promise<PythonEnvironment | undefined> => {
                if (!details) {
                    return Promise.resolve(undefined);
                }
                this._hasInterpreters.resolve(true);
                return Promise.resolve({
                    ...(details as PythonEnvironment),
                    envName: virtualEnvName,
                    type: type! as EnvironmentType,
                });
            },
        );
    }
}
