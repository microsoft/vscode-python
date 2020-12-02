// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { PythonEnvInfo } from './base/info';
import { isParentPath } from './common/externalDependencies';

export interface IEnvironmentsSecurity {
    /**
     * Returns `true` the environment is secure, `false` otherwise.
     */
    isEnvironmentSafe(env: PythonEnvInfo): boolean;
    /**
     * Mark all environments to be secure.
     */
    markAsSecure(): void;
}

export class EnvironmentsSecurity implements IEnvironmentsSecurity {
    /**
     * Carries `true` if it's secure to run all environment executables, `false` otherwise.
     */
    private isSecure = false;

    public isEnvironmentSafe(env: PythonEnvInfo): boolean {
        if (this.isSecure) {
            return true;
        }
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
            return true;
        }
        for (const root of folders.map((f) => f.uri.fsPath)) {
            if (isParentPath(env.executable.filename, root)) {
                return false;
            }
        }
        return true;
    }

    public markAsSecure(): void {
        this.isSecure = true;
    }
}
