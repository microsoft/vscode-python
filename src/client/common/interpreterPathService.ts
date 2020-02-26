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
            this.getSettingKey(resource, ConfigurationTarget.WorkspaceFolder),
            undefined
        );
        const workspaceSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
            this.getSettingKey(resource, ConfigurationTarget.Workspace),
            undefined
        );
        const globalSetting = this.workspaceService
            .getConfiguration('python', resource)!
            .inspect<string>('defaultInterpreterPath')!;
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

    public async update(
        resource: Resource,
        configTarget: ConfigurationTarget,
        pythonPath: string | undefined
    ): Promise<void> {
        if (configTarget === ConfigurationTarget.Global) {
            const pythonConfig = this.workspaceService.getConfiguration('python');
            await pythonConfig.update('defaultInterpreterPath', pythonPath, true);
            return;
        }
        const settingKey = this.getSettingKey(resource, configTarget);
        const persistentSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
            settingKey,
            undefined
        );
        await persistentSetting.updateValue(pythonPath);
    }

    public getSettingKey(
        resource: Resource,
        configTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder
    ): string {
        switch (configTarget) {
            case ConfigurationTarget.WorkspaceFolder: {
                if (!resource) {
                    throw new Error('No resource provided');
                }
                return `WORKSPACE_FOLDER_INTERPRETER_PATH_${this.workspaceService.getWorkspaceFolderIdentifier(
                    resource
                )}`;
            }
            default: {
                if (!resource) {
                    throw new Error('No resource provided');
                }
                const fsPathKey = this.workspaceService.workspaceFile
                    ? this.workspaceService.workspaceFile.fsPath
                    : // Only a single folder is opened, use fsPath of the folder as key
                      this.workspaceService.getWorkspaceFolderIdentifier(resource);
                return `WORKSPACE_INTERPRETER_PATH_${fsPathKey}`;
            }
        }
    }
}
