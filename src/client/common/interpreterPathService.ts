// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget, Event, EventEmitter } from 'vscode';
import { IWorkspaceService } from './application/types';
import { PythonSettings } from './configSettings';
import {
    IDisposableRegistry,
    IInterpreterPathService,
    InspectInterpreterSettingType,
    InterpreterConfigurationScope,
    IPersistentState,
    IPersistentStateFactory,
    Resource
} from './types';

@injectable()
export class InterpreterPathService implements IInterpreterPathService {
    private readonly didChangeInterpreterEmitter = new EventEmitter<InterpreterConfigurationScope>();
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        disposableRegistry.push(
            workspaceService.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('python.defaultInterpreterPath', undefined)) {
                    this.didChangeInterpreterEmitter.fire({ uri: undefined, configTarget: ConfigurationTarget.Global });
                }
            })
        );
    }

    public inspectInterpreterPath(resource: Resource): InspectInterpreterSettingType {
        resource = resource ? resource : PythonSettings.getSettingsUriAndTarget(resource, this.workspaceService).uri;
        let workspaceFolderSetting: IPersistentState<string | undefined> | undefined;
        let workspaceSetting: IPersistentState<string | undefined> | undefined;
        if (resource) {
            workspaceFolderSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
                this.getSettingKey(resource, ConfigurationTarget.WorkspaceFolder),
                undefined
            );
            workspaceSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
                this.getSettingKey(resource, ConfigurationTarget.Workspace),
                undefined
            );
        }
        const globalValue = this.workspaceService
            .getConfiguration('python', resource)!
            .get<string>('defaultInterpreterPath')!;
        return {
            globalValue,
            workspaceFolderValue: workspaceFolderSetting?.value,
            workspaceValue: workspaceSetting?.value
        };
    }

    public getInterpreterPath(resource: Resource): string {
        resource = resource ? resource : PythonSettings.getSettingsUriAndTarget(resource, this.workspaceService).uri;
        const settings = this.inspectInterpreterPath(resource);
        return settings.workspaceFolderValue || settings.workspaceValue || settings.globalValue || 'python';
    }

    public async update(
        resource: Resource,
        configTarget: ConfigurationTarget,
        pythonPath: string | undefined
    ): Promise<void> {
        resource = resource ? resource : PythonSettings.getSettingsUriAndTarget(resource, this.workspaceService).uri;
        if (configTarget === ConfigurationTarget.Global) {
            const pythonConfig = this.workspaceService.getConfiguration('python');
            await pythonConfig.update('defaultInterpreterPath', pythonPath, true);
            this.didChangeInterpreterEmitter.fire({ uri: undefined, configTarget });
            return;
        }
        const settingKey = this.getSettingKey(resource, configTarget);
        const persistentSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
            settingKey,
            undefined
        );
        await persistentSetting.updateValue(pythonPath);
        this.didChangeInterpreterEmitter.fire({ uri: resource, configTarget });
    }

    public get onDidChangeInterpreter(): Event<InterpreterConfigurationScope> {
        return this.didChangeInterpreterEmitter.event;
    }

    public getSettingKey(
        resource: Resource,
        configTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder
    ): string {
        let settingKey: string;
        const folderKey = this.workspaceService.getWorkspaceFolderIdentifier(resource);
        switch (configTarget) {
            case ConfigurationTarget.WorkspaceFolder: {
                if (!resource) {
                    throw new Error('No resource provided');
                }
                settingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${folderKey}`;
                break;
            }
            default: {
                if (!resource) {
                    throw new Error('No resource provided');
                }
                settingKey = this.workspaceService.workspaceFile
                    ? `WORKSPACE_INTERPRETER_PATH_${this.workspaceService.workspaceFile.fsPath}`
                    : // Only a single folder is opened, use fsPath of the folder as key
                      `WORKSPACE_FOLDER_INTERPRETER_PATH_${folderKey}`;
            }
        }
        return settingKey;
    }
}
