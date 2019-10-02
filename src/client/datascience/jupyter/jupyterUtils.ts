// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as path from 'path';
import { Uri } from 'vscode';

import { IWorkspaceService } from '../../common/application/types';

// tslint:disable: no-invalid-template-strings
export function expandFileVariable(fileVariable: string | undefined, file: string, workspace: IWorkspaceService): string | undefined {
    const folder = workspace.getWorkspaceFolder(Uri.file(file));

    // See here for the variable list: https://code.visualstudio.com/docs/editor/variables-reference
    switch (fileVariable) {
        case '${file}':
        case '${fileDirname}':
        default:
            // Just use the path of the file
            return path.dirname(file);

        case '${relativeFile}':
            if (folder) {
                return path.relative(folder.uri.fsPath, file);
            }
            break;

        case '${relativeFileDirname}':
            if (folder) {
                return path.relative(folder.uri.fsPath, path.dirname(file));
            }
            break;

        case '${cwd}':
            return process.cwd();

        case '${workspaceFolder}':
            if (folder) {
                return folder.uri.fsPath;
            }
            break;

        case '${execPath}':
            break;
    }

    return undefined;
}
