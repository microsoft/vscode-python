'use strict';
import * as _ from 'lodash';
import * as path from 'path';
import { Disposable, Uri, workspace } from 'vscode';
import { RegistryImplementation } from '../../common/platform/registry';
import { arePathsSame, Is_64Bit, IS_WINDOWS } from '../../common/utils';
import { IInterpreterLocatorService, PythonInterpreter } from '../contracts';
import { InterpreterVersionService } from '../interpreterVersion';
import { VirtualEnvironmentManager } from '../virtualEnvs';
import { fixInterpreterDisplayName } from './helpers';
import { CondaEnvFileService, getEnvironmentsFile as getCondaEnvFile } from './services/condaEnvFileService';
import { CondaEnvService } from './services/condaEnvService';
import { CondaLocatorService } from './services/condaLocator';
import { CurrentPathService } from './services/currentPathService';
import { getKnownSearchPathsForInterpreters, KnownPathsService } from './services/KnownPathsService';
import { getKnownSearchPathsForVirtualEnvs, VirtualEnvService } from './services/virtualEnvService';
import { WindowsRegistryService } from './services/windowsRegistryService';

export class PythonInterpreterLocatorService implements IInterpreterLocatorService {
    private interpretersPerResource: Map<string, PythonInterpreter[]>;
    private disposables: Disposable[] = [];
    constructor(private virtualEnvMgr: VirtualEnvironmentManager) {
        this.interpretersPerResource = new Map<string, PythonInterpreter[]>();
        this.disposables.push(workspace.onDidChangeConfiguration(this.onConfigChanged, this));
    }
    public async getInterpreters(resource?: Uri) {
        const resourceKey = this.getResourceKey(resource);
        if (!this.interpretersPerResource.has(resourceKey)) {
            const interpreters = await this.getInterpretersPerResource(resource);
            this.interpretersPerResource.set(resourceKey, interpreters);
        }

        // tslint:disable-next-line:no-non-null-assertion
        return this.interpretersPerResource.get(resourceKey)!;
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private onConfigChanged() {
        this.interpretersPerResource.clear();
    }
    private getResourceKey(resource?: Uri) {
        if (!resource) {
            return '';
        }
        const workspaceFolder = workspace.getWorkspaceFolder(resource);
        return workspaceFolder ? workspaceFolder.uri.fsPath : '';
    }
    private async getInterpretersPerResource(resource?: Uri) {
        const locators = this.getLocators(resource);
        const promises = locators.map(async provider => provider.getInterpreters(resource));
        const listOfInterpreters = await Promise.all(promises);

        // tslint:disable-next-line:underscore-consistent-invocation
        return _.flatten(listOfInterpreters)
            .map(fixInterpreterDisplayName)
            .map(item => { item.path = path.normalize(item.path); return item; })
            .reduce<PythonInterpreter[]>((accumulator, current) => {
                if (accumulator.findIndex(item => arePathsSame(item.path, current.path)) === -1) {
                    accumulator.push(current);
                }
                return accumulator;
            }, []);
    }
    private getLocators(resource?: Uri) {
        const locators: IInterpreterLocatorService[] = [];
        const versionService = new InterpreterVersionService();
        // The order of the services is important.
        if (IS_WINDOWS) {
            const windowsRegistryProvider = new WindowsRegistryService(new RegistryImplementation(), Is_64Bit);
            const condaLocator = new CondaLocatorService(IS_WINDOWS, windowsRegistryProvider);
            locators.push(windowsRegistryProvider);
            locators.push(new CondaEnvService(condaLocator));
        } else {
            const condaLocator = new CondaLocatorService(IS_WINDOWS);
            locators.push(new CondaEnvService(condaLocator));
        }
        // Supplements the above list of conda environments.
        locators.push(new CondaEnvFileService(getCondaEnvFile(), versionService));
        locators.push(new VirtualEnvService(getKnownSearchPathsForVirtualEnvs(resource), this.virtualEnvMgr, versionService));

        if (!IS_WINDOWS) {
            // This must be last, it is possible we have paths returned here that are already returned
            // in one of the above lists.
            locators.push(new KnownPathsService(getKnownSearchPathsForInterpreters(), versionService));
        }
        // This must be last, it is possible we have paths returned here that are already returned
        // in one of the above lists.
        locators.push(new CurrentPathService(this.virtualEnvMgr, versionService));

        return locators;
    }
}
