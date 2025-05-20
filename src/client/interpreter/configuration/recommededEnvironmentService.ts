// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IRecommendedEnvironmentService } from './types';
import { PythonExtension } from '../../api/types';
import { IExtensionContext, Resource } from '../../common/types';
import { Uri, workspace } from 'vscode';
import { getWorkspaceStateValue, updateWorkspaceStateValue } from '../../common/persistentState';
import { traceError } from '../../logging';

const MEMENTO_KEY = 'userSelectedEnvPath';

@injectable()
export class RecommendedEnvironmentService implements IRecommendedEnvironmentService {
    private api?: PythonExtension['environments'];
    constructor(@inject(IExtensionContext) private readonly extensionContext: IExtensionContext) {}

    registerEnvApi(api: PythonExtension['environments']) {
        this.api = api;
    }

    trackUserSelectedEnvironment(environmentPath: string | undefined, uri: Uri | undefined) {
        if (workspace.workspaceFolders?.length) {
            try {
                void updateWorkspaceStateValue(MEMENTO_KEY, getDataToStore(environmentPath, uri));
            } catch (ex) {
                traceError('Failed to update workspace state for preferred environment', ex);
            }
        } else {
            void this.extensionContext.globalState.update(MEMENTO_KEY, environmentPath);
        }
    }

    getRecommededEnvironment(
        resource: Resource,
    ):
        | { environmentPath: string; reason: 'globalUserSelected' | 'workspaceUserSelected' | 'defaultRecommended' }
        | undefined {
        let workspaceState: string | undefined = undefined;
        try {
            workspaceState = getWorkspaceStateValue<string>(MEMENTO_KEY);
        } catch (ex) {
            traceError('Failed to get workspace state for preferred environment', ex);
        }

        if (workspace.workspaceFolders?.length && workspaceState) {
            const workspaceUri = (
                (resource ? workspace.getWorkspaceFolder(resource)?.uri : undefined) ||
                workspace.workspaceFolders[0].uri
            ).toString();

            try {
                const existingJson: Record<string, string> = JSON.parse(workspaceState);
                const selectedEnvPath = existingJson[workspaceUri];
                if (selectedEnvPath) {
                    return { environmentPath: selectedEnvPath, reason: 'workspaceUserSelected' };
                }
            } catch (ex) {
                traceError('Failed to parse existing workspace state value for preferred environment', ex);
            }
        }

        const globalSelectedEnvPath = this.extensionContext.globalState.get<string | undefined>(MEMENTO_KEY);
        if (globalSelectedEnvPath) {
            return { environmentPath: globalSelectedEnvPath, reason: 'globalUserSelected' };
        }
        return this.api && workspace.isTrusted
            ? {
                  environmentPath: this.api.getActiveEnvironmentPath(resource).path,
                  reason: 'defaultRecommended',
              }
            : undefined;
    }
}

function getDataToStore(environmentPath: string | undefined, uri: Uri | undefined): string | undefined {
    if (!workspace.workspaceFolders?.length) {
        return environmentPath;
    }
    const workspaceUri = (
        (uri ? workspace.getWorkspaceFolder(uri)?.uri : undefined) || workspace.workspaceFolders[0].uri
    ).toString();
    const existingData = getWorkspaceStateValue<string>(MEMENTO_KEY);
    if (!existingData) {
        return JSON.stringify(environmentPath ? { [workspaceUri]: environmentPath } : {});
    }
    try {
        const existingJson: Record<string, string> = JSON.parse(existingData);
        if (environmentPath) {
            existingJson[workspaceUri] = environmentPath;
        } else {
            delete existingJson[workspaceUri];
        }
        return JSON.stringify(existingJson);
    } catch (ex) {
        traceError('Failed to parse existing workspace state value for preferred environment', ex);
        return JSON.stringify({
            [workspaceUri]: environmentPath,
        });
    }
}
