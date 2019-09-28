// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { exec } from 'child_process';
import { debug } from './logger';
import { sleep } from './misc';

export async function isPackageInstalled(pythonPath: string, moduleName: string): Promise<boolean> {
    const cmd = `${pythonPath.toCommandArgument()} -c "import ${moduleName};print('Hello World')"`;
    debug(`Executing command = ${cmd}`);
    return new Promise<boolean>(resolve => {
        exec(cmd, (ex, stdout: string, stdErr: string) => {
            if (ex || stdErr) {
                debug(`Executing command = ${cmd}, error: `, ex, stdErr);
                return resolve(false);
            }
            debug(`Executing command = ${cmd}, output: `, stdout);
            resolve(stdout.trim() === 'Hello World');
        });
    });
}

export async function installPackage(pythonPath: string, moduleName: string): Promise<void> {
    await installOrUninstallPackage(pythonPath, moduleName, true);
}
export async function uninstallModule(pythonPath: string, moduleName: string): Promise<void> {
    await installOrUninstallPackage(pythonPath, moduleName, false);
}
export async function installOrUninstallPackage(pythonPath: string, moduleName: string, install: boolean = true): Promise<void> {
    const installCmd = install ? 'install' : 'uninstall';
    const extraArgs = install ? [] : ['-y'];
    const cmd = `${pythonPath.toCommandArgument()} -m pip ${installCmd} ${moduleName} -q --disable-pip-version-check ${extraArgs.join(' ')}`;
    // tslint:disable-next-line: no-unnecessary-callback-wrapper
    return new Promise<void>(resolve => exec(cmd.trim(), () => resolve()));
}
export async function ensurePackageIsInstalled(pythonPath: string, moduleName: string): Promise<void> {
    const installed = await isPackageInstalled(pythonPath, moduleName);
    if (!installed) {
        await installPackage(pythonPath, moduleName);
        await sleep(1000);
    }
}
export async function ensurePackageIsNotInstalled(pythonPath: string, moduleName: string): Promise<void> {
    const installed = await isPackageInstalled(pythonPath, moduleName);
    debug(`Module ${moduleName} is installed = ${installed}`);
    if (installed) {
        await uninstallModule(pythonPath, moduleName);
        await sleep(1000);
    }
}
