import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri, workspace } from 'vscode';
import { fsReaddirAsync, IS_WINDOWS } from '../../../common/utils';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterVersionService, IKnownSearchPathsForVirtualEnvironments, InterpreterType, PythonInterpreter } from '../../contracts';
import { IVirtualEnvironmentManager } from '../../virtualEnvs/types';
import { lookForInterpretersInDirectory } from '../helpers';
import * as settings from './../../../common/configSettings';
import { CacheableLocatorService } from './cacheableLocatorService';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify = require('untildify');

@injectable()
export class VirtualEnvService extends CacheableLocatorService {
    public constructor( @inject(IKnownSearchPathsForVirtualEnvironments) private knownSearchPaths: string[],
        @inject(IVirtualEnvironmentManager) private virtualEnvMgr: IVirtualEnvironmentManager,
        @inject(IInterpreterVersionService) private versionProvider: IInterpreterVersionService,
        @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('KnownPathsService', serviceContainer);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.suggestionsFromKnownVenvs();
    }
    private async suggestionsFromKnownVenvs() {
        return Promise.all(this.knownSearchPaths.map(dir => this.lookForInterpretersInVenvs(dir)))
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(listOfInterpreters => _.flatten(listOfInterpreters));
    }
    private async lookForInterpretersInVenvs(pathToCheck: string) {
        return fsReaddirAsync(pathToCheck)
            .then(subDirs => Promise.all(this.getProspectiveDirectoriesForLookup(subDirs)))
            .then(dirs => dirs.filter(dir => dir.length > 0))
            .then(dirs => Promise.all(dirs.map(lookForInterpretersInDirectory)))
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(pathsWithInterpreters => _.flatten(pathsWithInterpreters))
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getVirtualEnvDetails(interpreter))))
            .catch((err) => {
                console.error('Python Extension (lookForInterpretersInVenvs):', err);
                // Ignore exceptions.
                return [] as PythonInterpreter[];
            });
    }
    private getProspectiveDirectoriesForLookup(subDirs: string[]) {
        const dirToLookFor = IS_WINDOWS ? 'SCRIPTS' : 'BIN';
        return subDirs.map(subDir => fsReaddirAsync(subDir)
            .then(dirs => {
                const scriptOrBinDirs = dirs.filter(dir => {
                    const folderName = path.basename(dir);
                    return folderName.toUpperCase() === dirToLookFor;
                });
                return scriptOrBinDirs.length === 1 ? scriptOrBinDirs[0] : '';
            })
            .catch((err) => {
                console.error('Python Extension (getProspectiveDirectoriesForLookup):', err);
                // Ignore exceptions.
                return '';
            }));

    }
    private async getVirtualEnvDetails(interpreter: string): Promise<PythonInterpreter> {
        return Promise.all([
            this.versionProvider.getVersion(interpreter, path.basename(interpreter)),
            this.virtualEnvMgr.detect(interpreter)
        ])
            .then(([displayName, virtualEnv]) => {
                const virtualEnvSuffix = virtualEnv ? virtualEnv.name : this.getVirtualEnvironmentRootDirectory(interpreter);
                return {
                    displayName: `${displayName} (${virtualEnvSuffix})`.trim(),
                    path: interpreter,
                    type: virtualEnv ? virtualEnv.type : InterpreterType.Unknown
                };
            });
    }
    private getVirtualEnvironmentRootDirectory(interpreter: string) {
        return path.basename(path.dirname(path.dirname(interpreter)));
    }
}

export function getKnownSearchPathsForVirtualEnvs(resource?: Uri): string[] {
    const paths: string[] = [];
    if (!IS_WINDOWS) {
        const defaultPaths = ['/Envs', '/.virtualenvs', '/.pyenv', '/.pyenv/versions'];
        defaultPaths.forEach(p => {
            paths.push(untildify(`~${p}`));
        });
    }
    const venvPath = settings.PythonSettings.getInstance(resource).venvPath;
    if (venvPath) {
        paths.push(untildify(venvPath));
    }
    if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
        if (resource && workspace.workspaceFolders.length > 1) {
            const wkspaceFolder = workspace.getWorkspaceFolder(resource);
            if (wkspaceFolder) {
                paths.push(wkspaceFolder.uri.fsPath);
            }
        } else {
            paths.push(workspace.workspaceFolders[0].uri.fsPath);
        }
    }
    return paths;
}
