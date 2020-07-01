// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as path from 'path';
import { Uri } from 'vscode';

import { IWorkspaceService } from '../../common/application/types';
import { noop } from '../../common/utils/misc';
import { SystemVariables } from '../../common/variables/systemVariables';
import { Identifiers } from '../constants';
import { getJupyterConnectionDisplayName } from '../jupyter/jupyterConnection';
import { IJupyterConnection, IJupyterUriProviderRegistration } from '../types';

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

export async function createRemoteConnectionInfo(
    uri: string,
    providerRegistration: IJupyterUriProviderRegistration
): Promise<IJupyterConnection> {
    let url: URL;
    try {
        url = new URL(uri);
    } catch (err) {
        // This should already have been parsed when set, so just throw if it's not right here
        throw err;
    }

    const id = url.searchParams.get(Identifiers.REMOTE_URI_ID_PARAM);
    const uriHandle = url.searchParams.get(Identifiers.REMOTE_URI_HANDLE_PARAM);
    const serverUri = id && uriHandle ? await providerRegistration.getJupyterServerUri(id, uriHandle) : undefined;
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
        displayName: getJupyterConnectionDisplayName(token, baseUrl),
        disconnected: (_l) => {
            return { dispose: noop };
        },
        dispose: noop,
        authorizationHeader: serverUri ? serverUri.authorizationHeader : undefined
    };
}
