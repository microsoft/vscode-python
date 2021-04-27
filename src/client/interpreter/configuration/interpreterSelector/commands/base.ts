// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable, unmanaged } from 'inversify';
import * as path from 'path';
import { ConfigurationTarget, Disposable, QuickPickItem, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../../../activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../../common/application/types';
import { IDisposable, Resource } from '../../../../common/types';
import { Interpreters } from '../../../../common/utils/localize';
import { IPythonPathUpdaterServiceManager } from '../../types';

@injectable()
export abstract class BaseInterpreterSelectorCommand implements IExtensionSingleActivationService, IDisposable {
    protected disposables: Disposable[] = [];
    constructor(
        @unmanaged() protected readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
        @unmanaged() protected readonly commandManager: ICommandManager,
        @unmanaged() protected readonly applicationShell: IApplicationShell,
        @unmanaged() protected readonly workspaceService: IWorkspaceService,
    ) {
        this.disposables.push(this);
    }

    public dispose() {
        this.disposables.forEach((disposable) => disposable.dispose());
    }

    public abstract activate(): Promise<void>;

    protected async getConfigTarget(): Promise<
        | {
              folderUri: Resource;
              configTarget: ConfigurationTarget;
          }
        | undefined
    > {
        if (
            !Array.isArray(this.workspaceService.workspaceFolders) ||
            this.workspaceService.workspaceFolders.length === 0
        ) {
            return {
                folderUri: undefined,
                configTarget: ConfigurationTarget.Global,
            };
        }
        if (!this.workspaceService.workspaceFile && this.workspaceService.workspaceFolders.length === 1) {
            return {
                folderUri: this.workspaceService.workspaceFolders[0].uri,
                configTarget: ConfigurationTarget.WorkspaceFolder,
            };
        }

        // Ok we have multiple workspaces, get the user to pick a folder.

        type WorkspaceSelectionQuickPickItem = QuickPickItem & { uri: Uri };
        const quickPickItems: WorkspaceSelectionQuickPickItem[] = [
            ...this.workspaceService.workspaceFolders.map((w) => ({
                label: w.name,
                description: path.dirname(w.uri.fsPath),
                uri: w.uri,
            })),
            {
                label: Interpreters.entireWorkspace(),
                uri: this.workspaceService.workspaceFolders[0].uri,
            },
        ];

        const selection = await this.applicationShell.showQuickPick(quickPickItems, {
            placeHolder: 'Select the workspace to set the interpreter',
        });

        return selection
            ? selection.label === Interpreters.entireWorkspace()
                ? { folderUri: selection.uri, configTarget: ConfigurationTarget.Workspace }
                : { folderUri: selection.uri, configTarget: ConfigurationTarget.WorkspaceFolder }
            : undefined;
    }
}
