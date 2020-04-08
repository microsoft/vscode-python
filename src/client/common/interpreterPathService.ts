// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, ConfigurationTarget, Event, EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from './application/types';
import { PythonSettings } from './configSettings';
import { isTestExecution } from './constants';
import {
    IDisposable,
    IDisposableRegistry,
    IInterpreterPathService,
    InspectInterpreterSettingType,
    InterpreterConfigurationScope,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings,
    Resource
} from './types';

export const defaultInterpreterPathSetting: keyof IPythonSettings = 'defaultInterpreterPath';
const CI_PYTHON_PATH = getCIPythonPath();

export function getCIPythonPath(): string {
    if (process.env.CI_PYTHON_PATH && fs.existsSync(process.env.CI_PYTHON_PATH)) {
        return process.env.CI_PYTHON_PATH;
    }
    return 'python';
}
@injectable()
export class InterpreterPathService implements IInterpreterPathService {
    public _didChangeInterpreterEmitter = new EventEmitter<InterpreterConfigurationScope>();
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IDisposableRegistry) disposables: IDisposable[]
    ) {
        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
    }

    public async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        if (event.affectsConfiguration(`python.${defaultInterpreterPathSetting}`)) {
            this._didChangeInterpreterEmitter.fire({ uri: undefined, configTarget: ConfigurationTarget.Global });
        }
    }

    public inspect(resource: Resource): InspectInterpreterSettingType {
        resource = PythonSettings.getSettingsUriAndTarget(resource, this.workspaceService).uri;
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
        const globalValue = this.workspaceService.getConfiguration('python')!.inspect<string>('defaultInterpreterPath')!
            .globalValue;
        return {
            globalValue,
            workspaceFolderValue: workspaceFolderSetting?.value,
            workspaceValue: workspaceSetting?.value
        };
    }

    public get(resource: Resource): string {
        const settings = this.inspect(resource);
        return (
            settings.workspaceFolderValue ||
            settings.workspaceValue ||
            settings.globalValue ||
            (isTestExecution() ? CI_PYTHON_PATH : 'python')
        );
    }

    public async update(
        resource: Resource,
        configTarget: ConfigurationTarget,
        pythonPath: string | undefined
    ): Promise<void> {
        resource = PythonSettings.getSettingsUriAndTarget(resource, this.workspaceService).uri;
        if (configTarget === ConfigurationTarget.Global) {
            const pythonConfig = this.workspaceService.getConfiguration('python');
            await pythonConfig.update('defaultInterpreterPath', pythonPath, true);
            this._didChangeInterpreterEmitter.fire({ uri: undefined, configTarget });
            return;
        }
        if (!resource) {
            throw new Error('Cannot update workspace settings as no workspace is opened');
        }
        const settingKey = this.getSettingKey(resource, configTarget);
        const persistentSetting = this.persistentStateFactory.createGlobalPersistentState<string | undefined>(
            settingKey,
            undefined
        );
        await persistentSetting.updateValue(pythonPath);
        this._didChangeInterpreterEmitter.fire({ uri: resource, configTarget });
    }

    public get onDidChange(): Event<InterpreterConfigurationScope> {
        return this._didChangeInterpreterEmitter.event;
    }

    public getSettingKey(
        resource: Uri,
        configTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder
    ): string {
        let settingKey: string;
        const folderKey = this.workspaceService.getWorkspaceFolderIdentifier(resource);
        if (configTarget === ConfigurationTarget.WorkspaceFolder) {
            settingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${folderKey}`;
        } else {
            settingKey = this.workspaceService.workspaceFile
                ? `WORKSPACE_INTERPRETER_PATH_${this.workspaceService.workspaceFile.fsPath}`
                : // Only a single folder is opened, use fsPath of the folder as key
                  `WORKSPACE_FOLDER_INTERPRETER_PATH_${folderKey}`;
        }
        return settingKey;
    }
}
