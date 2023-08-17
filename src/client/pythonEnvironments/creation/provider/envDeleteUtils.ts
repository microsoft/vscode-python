// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-extra';
import * as path from 'path';
import { WorkspaceFolder } from 'vscode';
import { traceError, traceInfo } from '../../../logging';
import { showErrorMessageWithLogs } from '../common/commonUtils';
import { CreateEnv } from '../../../common/utils/localize';
import { sleep } from '../../../common/utils/async';
import { switchSelectedPython } from './venvSwitchPython';

async function tryDeleteFile(file: string): Promise<boolean> {
    try {
        if (!(await fs.pathExists(file))) {
            return true;
        }
        await fs.unlink(file);
        return true;
    } catch (err) {
        traceError(`Failed to delete file [${file}]:`, err);
        return false;
    }
}

async function tryDeleteDir(dir: string): Promise<boolean> {
    try {
        if (!(await fs.pathExists(dir))) {
            return true;
        }
        await fs.rmdir(dir, {
            recursive: true,
            maxRetries: 10,
            retryDelay: 200,
        });
        return true;
    } catch (err) {
        traceError(`Failed to delete directory [${dir}]:`, err);
        return false;
    }
}

export async function deleteEnvironmentNonWindows(envDir: string): Promise<boolean> {
    const name = path.basename(envDir);
    if (await tryDeleteDir(envDir)) {
        traceInfo(`Deleted "${name}" dir: ${envDir}`);
        return true;
    }
    showErrorMessageWithLogs(CreateEnv.Venv.errorDeletingEnvironment);
    return false;
}

export async function deleteEnvironmentWindows(
    envDir: string,
    envPythonBin: string,
    workspaceFolder: WorkspaceFolder,
    interpreter: string | undefined,
): Promise<boolean> {
    const name = path.basename(envDir);
    if (await tryDeleteFile(envPythonBin)) {
        traceInfo(`Deleted python executable: ${envPythonBin}`);
        if (await tryDeleteDir(envDir)) {
            traceInfo(`Deleted "${name}" dir: ${envDir}`);
            return true;
        }

        traceError(`Failed to delete "${name}" dir: ${envDir}`);
        traceError(
            'This happens if the virtual environment is still in use, or some binary in the "${name}" is still running.',
        );
        traceError(`Please delete the "${name}" manually: [${envDir}]`);
        showErrorMessageWithLogs(CreateEnv.Venv.errorDeletingEnvironment);
        return false;
    }
    traceError(`Failed to delete python executable: ${envPythonBin}`);
    traceError('This happens if the virtual environment is still in use.');

    if (interpreter) {
        traceError('We will attempt to switch python temporarily to delete the "${name}"');

        await switchSelectedPython(interpreter, workspaceFolder.uri, 'temporarily to delete the "${name}"');

        traceInfo(`Attempting to delete "${name}" again: ${envDir}`);
        const ms = 500;
        for (let i = 0; i < 5; i = i + 1) {
            traceInfo(`Waiting for ${ms}ms to let processes exit, before a delete attempt.`);
            await sleep(ms);
            if (await tryDeleteDir(envDir)) {
                traceInfo(`Deleted "${name}" dir: ${envDir}`);
                return true;
            }
            traceError(`Failed to delete "${name}" dir [${envDir}] (attempt ${i + 1}/5).`);
        }
    } else {
        traceError(`Please delete the "${name}" dir manually: [${envDir}] manually.`);
    }
    showErrorMessageWithLogs(CreateEnv.Venv.errorDeletingEnvironment);
    return false;
}
