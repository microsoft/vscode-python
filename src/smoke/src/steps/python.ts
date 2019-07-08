// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// import { exec } from 'child_process';
// import { Given, When } from 'cucumber';
// import { sleep } from '../helpers';
// import { fileToCommandArgument } from '../setup/utils';
// import { context } from './app';

// // tslint:disable: no-unnecessary-callback-wrapper

// async function isModuleInstalled(pythonPath: string, moduleName: string): Promise<boolean> {
//     const cmd = `${fileToCommandArgument(pythonPath)} -c "import ${moduleName};print('Hello World')"`;
//     return new Promise<boolean>((resolve, reject) => {
//         exec(cmd, (ex, stdout: string, stdErr: string) => {
//             if (ex || stdErr) {
//                 return resolve(false);
//             }
//             resolve(stdout.trim() === 'Hello World');
//         });
//     });
// }

// async function installModule(pythonPath: string, moduleName: string): Promise<void> {
//     await installOrUninstallModule(pythonPath, moduleName, true);
// }
// async function uninstallModule(pythonPath: string, moduleName: string): Promise<void> {
//     await installOrUninstallModule(pythonPath, moduleName, false);
// }
// async function installOrUninstallModule(pythonPath: string, moduleName: string, install: boolean = true): Promise<void> {
//     const installCmd = install ? 'install' : 'uninstall';
//     const extraArgs = install ? [] : ['-y'];
//     const cmd = `${fileToCommandArgument(pythonPath)} -m pip ${installCmd} ${moduleName} -q --disable-pip-version-check ${extraArgs.join(' ')}`;
//     return new Promise<void>(resolve => exec(cmd.trim(), () => resolve()));
// }
// async function ensureModuleIsInstalled(pythonPath: string, moduleName: string): Promise<void> {
//     const installed = await isModuleInstalled(pythonPath, moduleName);
//     if (!installed) {
//         await installModule(pythonPath, moduleName);
//         await sleep(1000);
//     }
// }
// async function ensureModuleIsNotInstalled(pythonPath: string, moduleName: string): Promise<void> {
//     const installed = await isModuleInstalled(pythonPath, moduleName);
//     if (installed) {
//         await uninstallModule(pythonPath, moduleName);
//         await sleep(1000);
//     }
// }
// Given('the module {string} is not installed', async (moduleName: string) => {
//     await ensureModuleIsNotInstalled(context.app.activeEnvironment.pythonPath!, moduleName);
// });
// When('I install the module {string}', async (moduleName: string) => {
//     await ensureModuleIsInstalled(context.app.activeEnvironment.pythonPath!, moduleName);
// });
// When('I uninstall the module {string}', async (moduleName: string) => {
//     await ensureModuleIsInstalled(context.app.activeEnvironment.pythonPath!, moduleName);
// });
// Given('the module {string} is installed', async (moduleName: string) => {
//     await ensureModuleIsInstalled(context.app.activeEnvironment.pythonPath!, moduleName);
// });
