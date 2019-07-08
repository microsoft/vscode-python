// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { exec } from 'child_process';
import { context } from '../application';
import { sleep } from './misc';

export async function isPackageInstalled(moduleName: string): Promise<boolean> {
    const cmd = `${context.options.pythonPath.toCommandArgument()} -c "import ${moduleName};print('Hello World')"`;
    return new Promise<boolean>(resolve => {
        exec(cmd, (ex, stdout: string, stdErr: string) => {
            if (ex || stdErr) {
                return resolve(false);
            }
            resolve(stdout.trim() === 'Hello World');
        });
    });
}

export async function installPackage(moduleName: string): Promise<void> {
    await installOrUninstallPackage(moduleName, true);
}
export async function uninstallModule(moduleName: string): Promise<void> {
    await installOrUninstallPackage(moduleName, false);
}
export async function installOrUninstallPackage(moduleName: string, install: boolean = true): Promise<void> {
    const installCmd = install ? 'install' : 'uninstall';
    const extraArgs = install ? [] : ['-y'];
    const cmd = `${context.options.pythonPath.toCommandArgument()} -m pip ${installCmd} ${moduleName} -q --disable-pip-version-check ${extraArgs.join(' ')}`;
    // tslint:disable-next-line: no-unnecessary-callback-wrapper
    return new Promise<void>(resolve => exec(cmd.trim(), () => resolve()));
}
export async function ensurePackageIsInstalled(moduleName: string): Promise<void> {
    const installed = await isPackageInstalled(moduleName);
    if (!installed) {
        await installPackage(moduleName);
        await sleep(1000);
    }
}
export async function ensurePackageIsNotInstalled(moduleName: string): Promise<void> {
    const installed = await isPackageInstalled(moduleName);
    if (installed) {
        await uninstallModule(moduleName);
        await sleep(1000);
    }
}

// type PythonEnvironment = 'venv' | 'standard';
// export type PythonEnvironment = {
//     name: string;
//     // execPath: string;
//     envPath: string;
//     type: 'venv' | 'standard';
// };

// export function createEnvironment(options: { type: PythonEnvironment; name: string }): Promise<PythonEnvironment> {

// }

// async function createVenv(name: string, cwd: string): Promise<PythonEnvironment> {
//     const cmd = `${context.options.python3Path.toCommandArgument()} -m venv ${name.toCommandArgument()}`;
//     await new Promise<void>((resolve, reject) => exec(cmd.trim(), { cwd }, (error: Error | null, _: string | Buffer, stdErr: string | Buffer) => {
//         if (error) {
//             return reject(error);
//         }
//         if (stdErr) {
//             return reject(stdErr.toString());
//         }
//         resolve();
//     }));
//     return {
//         type: 'venv',
//         name,
//         envPath: path.join(cwd, name)
//     };
// }
