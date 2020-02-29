// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget, Event, EventEmitter } from 'vscode';
import { ICommandManager, IWorkspaceService } from './application/types';
import { PythonSettings } from './configSettings';
import { Commands } from './constants';
import {
    IDisposableRegistry,
    IInterpreterPathService,
    InterpreterConfigurationScope,
    IPersistentStateFactory,
    Resource
} from './types';

@injectable()
export class InterpreterPathService implements IInterpreterPathService {
    private readonly didChangeInterpreterEmitter = new EventEmitter<InterpreterConfigurationScope>();
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(ICommandManager) private readonly commandManager: ICommandManager
    ) {
        disposableRegistry.push(
            workspaceService.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('python.defaultInterpreterPath', undefined)) {
                    this.didChangeInterpreterEmitter.fire({ uri: undefined, configTarget: ConfigurationTarget.Global });
                }
            })
        );
        disposableRegistry.push(
            this.commandManager.registerCommand(Commands.ResetPythonInterpreters, () =>
                this.clearAllInterpreterPathSettings().ignoreErrors()
            )
        );
    }

    public inspectInterpreterPath(
        resource: Resource
    ): {
        globalValue?: string;
        workspaceValue?: string;
        workspaceFolderValue?: string;
    } {
        resource = resource ? resource : PythonSettings.getSettingsUriAndTarget(resource, this.workspaceService).uri;
        const workspaceFolderSetting = resource
            ? this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
                  this.getSettingKey(resource, ConfigurationTarget.WorkspaceFolder),
                  undefined
              )
            : undefined;
        const workspaceSetting = resource
            ? this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
                  this.getSettingKey(resource, ConfigurationTarget.Workspace),
                  undefined
              )
            : undefined;
        const globalSetting = this.workspaceService
            .getConfiguration('python', resource)!
            .get<string>('defaultInterpreterPath')!;
        return {
            globalValue: globalSetting,
            workspaceFolderValue: workspaceFolderSetting?.value,
            workspaceValue: workspaceSetting?.value
        };
    }

    public interpreterPath(resource: Resource): string {
        resource = resource ? resource : PythonSettings.getSettingsUriAndTarget(resource, this.workspaceService).uri;
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
                const fsPathKey = this.workspaceService.workspaceFile
                    ? this.workspaceService.workspaceFile.fsPath
                    : // Only a single folder is opened, use fsPath of the folder as key
                      folderKey;
                settingKey = `WORKSPACE_INTERPRETER_PATH_${fsPathKey}`;
            }
        }
        return settingKey;
    }

    public async clearAllInterpreterPathSettings(): Promise<void> {
        if (!this.workspaceService.hasWorkspaceFolders) {
            return;
        }
        const settingKeys = this.workspaceService
            .workspaceFolders!.map(workspaceFolder =>
                this.getSettingKey(workspaceFolder.uri, ConfigurationTarget.WorkspaceFolder)
            )
            .concat(this.getSettingKey(this.workspaceService.workspaceFolders![0].uri, ConfigurationTarget.Workspace));
        for (const key of settingKeys) {
            const persistentSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
                key,
                undefined
            );
            await persistentSetting.updateValue(undefined);
        }
    }
}
