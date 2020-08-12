// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as fs from 'fs-extra';
import * as path from 'path';
import { Uri } from 'vscode';

import { IWorkspaceService } from '../../common/application/types';
import { Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { SystemVariables } from '../../common/variables/systemVariables';
import { getJupyterConnectionDisplayName } from '../jupyter/jupyterConnection';
import { IJupyterConnection, IJupyterServerUri } from '../types';

export function expandWorkingDir(
    workingDir: string | undefined,
    launchingFile: string | undefined,
    workspace: IWorkspaceService
): string {
    if (workingDir) {
        const variables = new SystemVariables(
            launchingFile ? Uri.file(launchingFile) : undefined,
            workspace.rootPath,
            workspace
        );
        return variables.resolve(workingDir);
    }

    // No working dir, just use the path of the launching file.
    if (launchingFile) {
        return path.dirname(launchingFile);
    }

    // No launching file or working dir. Just use the default workspace folder
    const workspaceFolder = workspace.getWorkspaceFolder(undefined);
    if (workspaceFolder) {
        return workspaceFolder.uri.fsPath;
    }

    return process.cwd();
}

export function createRemoteConnectionInfo(
    uri: string,
    getJupyterServerUri: (uri: string) => IJupyterServerUri | undefined
): IJupyterConnection {
    let url: URL;
    try {
        url = new URL(uri);
    } catch (err) {
        // This should already have been parsed when set, so just throw if it's not right here
        throw err;
    }

    const serverUri = getJupyterServerUri(uri);
    const baseUrl = serverUri ? serverUri.baseUrl : `${url.protocol}//${url.host}${url.pathname}`;
    const token = serverUri ? serverUri.token : `${url.searchParams.get('token')}`;
    const hostName = serverUri ? new URL(serverUri.baseUrl).hostname : url.hostname;

    return {
        type: 'jupyter',
        baseUrl,
        token,
        hostName,
        localLaunch: false,
        localProcExitCode: undefined,
        valid: true,
        displayName:
            serverUri && serverUri.displayName
                ? serverUri.displayName
                : getJupyterConnectionDisplayName(token, baseUrl),
        disconnected: (_l) => {
            return { dispose: noop };
        },
        dispose: noop,
        rootDirectory: '',
        getAuthHeader: serverUri ? () => getJupyterServerUri(uri)?.authorizationHeader : undefined
    };
}

export async function computeWorkingDirectory(resource: Resource, workspace: IWorkspaceService): Promise<string> {
    // Returning directly doesn't seem to work (typescript complains)
    // tslint:disable-next-line: no-unnecessary-local-variable
    const workingDirectory =
        resource && resource.scheme === 'file' && (await fs.pathExists(path.dirname(resource.fsPath)))
            ? path.dirname(resource.fsPath)
            : workspace.getWorkspaceFolder(resource)?.uri.fsPath || process.cwd();

    return workingDirectory;
}
