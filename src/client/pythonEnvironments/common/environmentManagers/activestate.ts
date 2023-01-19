// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { pathExists, shellExecute } from '../externalDependencies';
import { cache } from '../../../common/utils/decorators';
import { traceError, traceVerbose } from '../../../logging';

const STATE_GENERAL_TIMEOUT = 50000;

export type ProjectInfo = {
    name: string;
    organization: string;
    local_checkouts: string[]; // eslint-disable-line camelcase
    executables: string[];
};

export async function isActiveStateEnvironment(interpreterPath: string): Promise<boolean> {
    const execDir = path.dirname(interpreterPath);
    const runtimeDir = path.dirname(execDir);
    return pathExists(path.join(runtimeDir, '_runtime_store'));
}

export class ActiveState {
    public static readonly stateCommand: string = 'state';

    public static async getProjects(): Promise<ProjectInfo[] | undefined> {
        return this.getProjectsCached();
    }

    @cache(30_000, true, 10_000)
    private static async getProjectsCached(): Promise<ProjectInfo[] | undefined> {
        try {
            const result = await shellExecute(`${this.stateCommand} projects -o json`, {
                timeout: STATE_GENERAL_TIMEOUT,
            });
            if (!result) {
                return undefined;
            }
            let output = result.stdout.trimEnd();
            if (output[output.length - 1] === '\0') {
                // '\0' is a record separator.
                output = output.substring(0, output.length - 1);
            }
            traceVerbose(`${this.stateCommand} projects -o json: ${output}`);
            return JSON.parse(output);
        } catch (ex) {
            traceError(ex);
            return undefined;
        }
    }
}
