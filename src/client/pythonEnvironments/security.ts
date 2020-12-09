// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { PythonEnvInfo } from './base/info';
import { isParentPath } from './common/externalDependencies';

/**
 * Keeps track of which environments are safe to execute.
 */
export interface IEnvironmentsSecurity {
    /**
     * Returns `true` the environment is safe to execute, `false` otherwise.
     */
    isEnvSafe(env: PythonEnvInfo): boolean;
    /**
     * Mark all environments to be safe.
     */
    markAllEnvsAsSafe(): void;
}

/**
 * Keeps track of which environments are safe to execute.
 */
export class EnvironmentsSecurity implements IEnvironmentsSecurity {
    /**
     * Carries `true` if it's secure to run all environment executables, `false` otherwise.
     */
    private allEnvsSafe = false;

    public isEnvSafe(env: PythonEnvInfo): boolean {
        if (this.allEnvsSafe) {
            return true;
        }
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
            return true;
        }
        for (const root of folders.map((f) => f.uri.fsPath)) {
            // Note `env.searchLocation` carries the root where the env was discovered which may
            // not be related this workspace root. Hence use `env.executable.filename` directly.
            if (isParentPath(env.executable.filename, root)) {
                // For now we consider all "workspace environments" to be unsafe by default.
                return false;
            }
        }
        return true;
    }

    public markAllEnvsAsSafe(): void {
        this.allEnvsSafe = true;
    }
}
