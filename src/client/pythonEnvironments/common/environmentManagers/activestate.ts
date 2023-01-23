// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { pathExists, shellExecute } from '../externalDependencies';
import { cache } from '../../../common/utils/decorators';
import { traceError, traceVerbose } from '../../../logging';
import { isTestExecution } from '../../../common/constants';
import { getOSType, getUserHomeDir, OSType } from '../../../common/utils/platform';

const STATE_GENERAL_TIMEOUT = 5000;

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
    private static statePromise: Promise<ActiveState | undefined> | undefined;

    public static async getState(): Promise<ActiveState | undefined> {
        if (ActiveState.statePromise === undefined || isTestExecution()) {
            ActiveState.statePromise = ActiveState.locate();
        }
        return ActiveState.statePromise;
    }

    public static getStateToolDir(): string | undefined {
        const home = getUserHomeDir();
        if (!home) {
            return undefined;
        }
        return getOSType() === OSType.Windows
            ? path.join(home, 'AppData', 'Local', 'ActiveState', 'StateTool')
            : path.join(home, '.local', 'ActiveState', 'StateTool');
    }

    private static async locate(): Promise<ActiveState | undefined> {
        const stateToolDir = this.getStateToolDir();
        if ((stateToolDir && (await pathExists(stateToolDir))) || isTestExecution()) {
            return new ActiveState();
        }
        return undefined;
    }

    public async getProjects(): Promise<ProjectInfo[] | undefined> {
        return this.getProjectsCached();
    }

    private static readonly stateCommand: string = 'state';

    @cache(30_000, true, 10_000)
    // eslint-disable-next-line class-methods-use-this
    private async getProjectsCached(): Promise<ProjectInfo[] | undefined> {
        try {
            const result = await shellExecute(`${ActiveState.stateCommand} projects -o editor`, {
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
            traceVerbose(`${ActiveState.stateCommand} projects -o editor: ${output}`);
            return JSON.parse(output);
        } catch (ex) {
            traceError(ex);
            return undefined;
        }
    }
}
