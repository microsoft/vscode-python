// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as path from 'path';
import { Uri } from 'vscode';

import { IWorkspaceService } from '../../common/application/types';
import { noop } from '../../common/utils/misc';
import { SystemVariables } from '../../common/variables/systemVariables';
import { getJupyterConnectionDisplayName } from '../jupyter/jupyterConnection';
import { IJupyterConnection } from '../types';

export function expandWorkingDir(
    workingDir: string | undefined,
    launchingFile: string,
    workspace: IWorkspaceService
): string {
    if (workingDir) {
        const variables = new SystemVariables(Uri.file(launchingFile), undefined, workspace);
        return variables.resolve(workingDir);
    }

    // No working dir, just use the path of the launching file.
    return path.dirname(launchingFile);
}

export function createRemoteConnectionInfo(uri: string): IJupyterConnection {
    let url: URL;
    try {
        url = new URL(uri);
    } catch (err) {
        // This should already have been parsed when set, so just throw if it's not right here
        throw err;
    }

    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
    const token = `${url.searchParams.get('token')}`;

    return {
        type: 'jupyter',
        baseUrl,
        token,
        hostName: url.hostname,
        localLaunch: false,
        localProcExitCode: undefined,
        valid: true,
        displayName: getJupyterConnectionDisplayName(token, baseUrl),
        disconnected: (_l) => {
            return { dispose: noop };
        },
        dispose: noop
    };
}
