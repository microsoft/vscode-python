// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as path from 'path';
import { Uri } from 'vscode';

import { IWorkspaceService } from '../../common/application/types';
import { IDataScienceSettings } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { SystemVariables } from '../../common/variables/systemVariables';
import { Identifiers } from '../constants';
import { ICell, IConnection } from '../types';

// tslint:disable-next-line:no-require-imports no-var-requires
const _escapeRegExp = require('lodash/escapeRegExp') as typeof import('lodash/escapeRegExp');

export function expandWorkingDir(workingDir: string | undefined, launchingFile: string, workspace: IWorkspaceService): string {
    if (workingDir) {
        const variables = new SystemVariables(Uri.file(launchingFile), undefined, workspace);
        return variables.resolve(workingDir);
    }

    // No working dir, just use the path of the launching file.
    return path.dirname(launchingFile);
}

export function createRemoteConnectionInfo(uri: string, settings: IDataScienceSettings): IConnection {
    let url: URL;
    try {
        url = new URL(uri);
    } catch (err) {
        // This should already have been parsed when set, so just throw if it's not right here
        throw err;
    }
    const allowUnauthorized = settings.allowUnauthorizedRemoteConnection ? settings.allowUnauthorizedRemoteConnection : false;

    return {
        allowUnauthorized,
        baseUrl: `${url.protocol}//${url.host}${url.pathname}`,
        token: `${url.searchParams.get('token')}`,
        hostName: url.hostname,
        localLaunch: false,
        localProcExitCode: undefined,
        disconnected: _l => {
            return { dispose: noop };
        },
        dispose: noop
    };
}

const LineMatchRegex = /(;32m[ ->]*?)(\d+)/g;
const IPythonMatchRegex = /(<ipython-input.*?>)/g;

function modifyLineNumbers(entry: string, startLine: number): string {
    return entry.replace(LineMatchRegex, (_s, prefix, num) => {
        const n = parseInt(num, 10);
        // Todo: href for source click
        return `${prefix}${startLine + n + 1}`;
    });
}

function modifyTracebackEntry(fileMatchRegex: RegExp, file: string, startLine: number, entry: string): string {
    if (fileMatchRegex.test(entry)) {
        return modifyLineNumbers(entry, startLine);
    } else if (IPythonMatchRegex.test(entry)) {
        const ipythonReplaced = entry.replace(IPythonMatchRegex, file);
        return modifyLineNumbers(ipythonReplaced, startLine);
    }
    return entry;
}

export function modifyTraceback(file: string, startLine: number, traceback: string[]): string[] {
    if (file && file !== Identifiers.EmptyFileName) {
        const escaped = _escapeRegExp(file);
        const fileMatchRegex = new RegExp(`\\[.*?;32m${escaped}`);
        return traceback.map(modifyTracebackEntry.bind(undefined, fileMatchRegex, file, startLine));
    }
    return traceback;
}
