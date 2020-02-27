// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget, Event, EventEmitter } from 'vscode';
import { IInterpreterAutoSeletionProxyService } from '../interpreter/autoSelection/types';
import { PythonInterpreter } from '../interpreter/contracts';
import { ICommandManager, IWorkspaceService } from './application/types';
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
    public readonly settingKeys = new Set<string>();
    private autoSelectedPythonInterpreter: PythonInterpreter | undefined;
    private readonly didChangeInterpreterEmitter = new EventEmitter<InterpreterConfigurationScope>();
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IInterpreterAutoSeletionProxyService)
        private readonly interpreterAutoSelectionService: IInterpreterAutoSeletionProxyService,
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
            .inspect<string>('defaultInterpreterPath')!;
        return {
            globalValue: globalSetting.globalValue,
            workspaceFolderValue: workspaceFolderSetting?.value,
            workspaceValue: workspaceSetting?.value
        };
    }

    public interpreterPath(resource: Resource): string {
        const settings = this.inspectInterpreterPath(resource);
        let interpreterPath =
            settings.workspaceFolderValue !== undefined
                ? settings.workspaceFolderValue
                : settings.workspaceValue !== undefined
                ? settings.workspaceValue
                : settings.globalValue !== undefined
                ? settings.globalValue
                : 'python';
        if (!this.autoSelectedPythonInterpreter && resource && interpreterPath === 'python') {
            const autoSelectedPythonInterpreter = this.interpreterAutoSelectionService.getAutoSelectedInterpreter(
                resource
            );
            if (autoSelectedPythonInterpreter) {
                this.interpreterAutoSelectionService
                    .setWorkspaceInterpreter(resource, autoSelectedPythonInterpreter)
                    .ignoreErrors();
            }
        }
        interpreterPath = this.autoSelectedPythonInterpreter
            ? this.autoSelectedPythonInterpreter.path
            : interpreterPath;
        return interpreterPath;
    }

    public async update(
        resource: Resource,
        configTarget: ConfigurationTarget,
        pythonPath: string | undefined
    ): Promise<void> {
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
        this.settingKeys.add(settingKey);
        return settingKey;
    }

    public async clearAllInterpreterPathSettings(): Promise<void> {
        const settingKeys = Array.from(this.settingKeys.keys());
        for (const key of settingKeys) {
            const persistentSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
                key,
                undefined
            );
            await persistentSetting.updateValue(undefined);
        }
        this.settingKeys.clear();
    }
}
