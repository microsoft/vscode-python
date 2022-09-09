/* eslint-disable @typescript-eslint/no-explicit-any */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { WorkspaceFolder } from 'vscode';
import { getWorkspaceFolder } from '../../../../common/utils/workspaceFolder';

/**
 * @returns whether the provided parameter is a JavaScript String or not.
 */
function isString(str: any): str is string {
    if (typeof str === 'string' || str instanceof String) {
        return true;
    }

    return false;
}

export function resolveVariables(
    value: string,
    rootFolder: string | undefined,
    folder: WorkspaceFolder | undefined,
): string {
    const workspace = folder ? getWorkspaceFolder(folder.uri) : undefined;
    const variablesObject: { [key: string]: any } = {};
    variablesObject.workspaceFolder = workspace ? workspace.uri.fsPath : rootFolder;

    const regexp = /\$\{(.*?)\}/g;
    return value.replace(regexp, (match: string, name: string) => {
        const newValue = variablesObject[name];
        if (isString(newValue)) {
            return newValue;
        }
        return match && (match.indexOf('env.') > 0 || match.indexOf('env:') > 0) ? '' : match;
    });
}
