// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as path from 'path';
import { Uri } from 'vscode';

import { IWorkspaceService } from '../../common/application/types';
import { SystemVariables } from '../../common/variables/systemVariables';

export function expandWorkingDir(workingDir: string | undefined, launchingFile: string, workspace: IWorkspaceService): string {
    if (workingDir) {
        const variables = new SystemVariables(Uri.file(launchingFile), undefined, workspace);
        return variables.resolve(workingDir);
    }

    // No working dir, just use the path of the launching file.
    return path.dirname(launchingFile);
}
