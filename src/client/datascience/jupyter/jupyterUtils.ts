// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as path from 'path';
import { Uri } from 'vscode';

import stripAnsi from 'strip-ansi';
import { IWorkspaceService } from '../../common/application/types';
import { IDataScienceSettings } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { SystemVariables } from '../../common/variables/systemVariables';
import { getJupyterConnectionDisplayName } from '../jupyter/jupyterConnection';
import { IConnection } from '../types';

const LineNumberMatchRegex = /(;32m[ ->]*?)(\d+)/g;

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

export function createRemoteConnectionInfo(uri: string, settings: IDataScienceSettings): IConnection {
    let url: URL;
    try {
        url = new URL(uri);
    } catch (err) {
        // This should already have been parsed when set, so just throw if it's not right here
        throw err;
    }
    const allowUnauthorized = settings.allowUnauthorizedRemoteConnection
        ? settings.allowUnauthorizedRemoteConnection
        : false;

    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
    const token = `${url.searchParams.get('token')}`;

    return {
        type: 'jupyter',
        allowUnauthorized,
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

// This function will modify a traceback from an error message.
// Tracebacks take a form like so:
// "[1;31m---------------------------------------------------------------------------[0m"
// "[1;31mZeroDivisionError[0m                         Traceback (most recent call last)"
// "[1;32md:\Training\SnakePython\foo.py[0m in [0;36m<module>[1;34m[0m\n[0;32m      1[0m [0mprint[0m[1;33m([0m[1;34m'some more'[0m[1;33m)[0m[1;33m[0m[1;33m[0m[0m\n    [1;32m----> 2[1;33m [0mcause_error[0m[1;33m([0m[1;33m)[0m[1;33m[0m[1;33m[0m[0m\n    [0m"
// "[1;32md:\Training\SnakePython\foo.py[0m in [0;36mcause_error[1;34m()[0m\n[0;32m      3[0m     [0mprint[0m[1;33m([0m[1;34m'error'[0m[1;33m)[0m[1;33m[0m[1;33m[0m[0m\n    [0;32m      4[0m     [0mprint[0m[1;33m([0m[1;34m'now'[0m[1;33m)[0m[1;33m[0m[1;33m[0m[0m\n    [1;32m----> 5[1;33m     [0mprint[0m[1;33m([0m [1;36m1[0m [1;33m/[0m [1;36m0[0m[1;33m)[0m[1;33m[0m[1;33m[0m[0m\n    [0m"
// "[1;31mZeroDivisionError[0m: division by zero"
// Each item in the array being a stack frame.
export function modifyTraceback(
    traceback: string[],
    traceBackRegexes: Map<string, RegExp>,
    hashes: Map<string, { trimmedRightCode: string; firstNonBlankLineIndex: number }[]>
): string[] {
    // Do one frame at a time.
    return traceback ? traceback.map(modifyTracebackFrame.bind(undefined, traceBackRegexes, hashes)) : [];
}

function findCellOffset(
    hashes: { trimmedRightCode: string; firstNonBlankLineIndex: number }[] | undefined,
    codeLines: string
): number | undefined {
    if (hashes) {
        // Go through all cell code looking for these code lines exactly
        // (although with right side trimmed as that's what a stack trace does)
        for (const hash of hashes) {
            const index = hash.trimmedRightCode.indexOf(codeLines);
            if (index >= 0) {
                // Jupyter isn't counting blank lines at the top so use our
                // first non blank line
                return hash.firstNonBlankLineIndex;
            }
        }
    }
    // No hash found
    return undefined;
}

function modifyTracebackFrame(
    traceBackRegexes: Map<string, RegExp>,
    hashes: Map<string, { trimmedRightCode: string; firstNonBlankLineIndex: number }[]>,
    traceFrame: string
): string {
    // See if this item matches any of our cell files
    const regexes = [...traceBackRegexes.entries()];
    const match = regexes.find((e) => e[1].test(traceFrame));
    if (match) {
        // We have a match, pull out the source lines
        let sourceLines = '';
        const regex = /(;32m[ ->]*?)(\d+)(.*)/g;
        for (let l = regex.exec(traceFrame); l && l.length > 3; l = regex.exec(traceFrame)) {
            const newLine = stripAnsi(l[3]).substr(1); // Seem to have a space on the front
            sourceLines = `${sourceLines}${newLine}\n`;
        }

        // Now attempt to find a cell that matches these source lines
        const offset = findCellOffset(hashes.get(match[0]), sourceLines);
        if (offset !== undefined) {
            return traceFrame.replace(LineNumberMatchRegex, (_s, prefix, num) => {
                const n = parseInt(num, 10);
                const newLine = offset + n - 1;
                return `${prefix}<a href='file://${match[0]}?line=${newLine}'>${newLine + 1}</a>`;
            });
        }
    }
    return traceFrame;
}
