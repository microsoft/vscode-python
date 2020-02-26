// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IWorkspaceService } from './application/types';
import { IInterpreterPathService, IPersistentStateFactory, Resource } from './types';

@injectable()
export class InterpreterPathService implements IInterpreterPathService {
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) {}

    public inspectInterpreterPath(
        resource: Resource
    ): {
        globalValue?: string;
        workspaceValue?: string;
        workspaceFolderValue?: string;
    } {
        const workspaceFolderSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
            'workspaceFolderSettingKey',
            undefined
        );
        const workspaceSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
            'workspaceSettingKey',
            undefined
        );
        const globalSetting = this.workspaceService
            .getConfiguration('python', resource)!
            .inspect<string>('pythonPath')!;
        return {
            globalValue: globalSetting.globalValue,
            workspaceFolderValue: workspaceFolderSetting.value,
            workspaceValue: workspaceSetting.value
        };
    }

    public interpreterPath(resource: Resource): string {
        const settings = this.inspectInterpreterPath(resource);
        return settings.workspaceFolderValue !== undefined
            ? settings.workspaceFolderValue
            : settings.workspaceValue !== undefined
            ? settings.workspaceValue
            : settings.globalValue !== undefined
            ? settings.globalValue
            : 'python';
    }

    public async update(resource: Resource, configTarget: ConfigurationTarget, pythonPath: string): Promise<void> {
        let settingKey: string;
        switch (configTarget) {
            case ConfigurationTarget.Global: {
                const pythonConfig = this.workspaceService.getConfiguration('python');
                await pythonConfig.update('defaultInterpreterPath', pythonPath, true);
                return;
            }
            case ConfigurationTarget.Workspace: {
                if (!resource) {
                    throw new Error('Workspace Uri not defined');
                }
                settingKey = `WORKSPACE_INTERPRETER_PATH_${resource.fsPath}`;
                break;
            }
            default: {
                if (!resource) {
                    throw new Error('Workspace Uri not defined');
                }
                settingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${resource.fsPath}`;
            }
        }
        const persistentSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
            settingKey,
            undefined
        );
        await persistentSetting.updateValue(pythonPath);
    }
}
