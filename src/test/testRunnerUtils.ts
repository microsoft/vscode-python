// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as cp from 'child_process';
import * as path from 'path';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import type { TestOptions } from '@vscode/test-electron/out/runTest';

/**
 * A fixed version of runTests from @vscode/test-electron that properly handles
 * paths containing spaces on Windows.
 *
 * The issue with @vscode/test-electron@2.5.2 is that it uses `shell: true` on Windows
 * when spawning VS Code. This causes command-line arguments containing spaces to be
 * split at the spaces, resulting in truncated paths being passed to VS Code.
 *
 * This function avoids shell mode by spawning VS Code directly, which correctly
 * handles both executable paths and argument paths that contain spaces.
 */
export async function runTests(options: TestOptions): Promise<number> {
    let vscodeExecutablePath = options.vscodeExecutablePath;
    if (!vscodeExecutablePath) {
        try {
            vscodeExecutablePath = await downloadAndUnzipVSCode(options);
        } catch (err) {
            throw new Error(`Failed to download VS Code for testing: ${err}`);
        }
    }

    let args = [
        // https://github.com/microsoft/vscode/issues/84238
        '--no-sandbox',
        // https://github.com/microsoft/vscode-test/issues/221
        '--disable-gpu-sandbox',
        // https://github.com/microsoft/vscode/issues/120
        '--disable-updates',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-workspace-trust',
        `--extensionTestsPath=${options.extensionTestsPath}`,
    ];

    if (Array.isArray(options.extensionDevelopmentPath)) {
        args.push(...options.extensionDevelopmentPath.map((devPath) => `--extensionDevelopmentPath=${devPath}`));
    } else {
        args.push(`--extensionDevelopmentPath=${options.extensionDevelopmentPath}`);
    }

    if (options.launchArgs) {
        args = options.launchArgs.concat(args);
    }

    if (!options.reuseMachineInstall) {
        // Add profile arguments (extensions-dir and user-data-dir) if not already provided.
        // The default cache path mirrors what @vscode/test-electron uses internally.
        const cachePath = path.resolve(process.cwd(), '.vscode-test');
        if (!args.some((a) => a === '--extensions-dir' || a.startsWith('--extensions-dir='))) {
            args.push(`--extensions-dir=${path.join(cachePath, 'extensions')}`);
        }
        if (!args.some((a) => a === '--user-data-dir' || a.startsWith('--user-data-dir='))) {
            args.push(`--user-data-dir=${path.join(cachePath, 'user-data')}`);
        }
    }

    const fullEnv = Object.assign({}, process.env, options.extensionTestsEnv);

    // Spawn VS Code directly without `shell: true` to avoid the Windows path-splitting
    // issue that occurs when arguments contain spaces. Node.js's child_process.spawn
    // handles executable and argument paths with spaces correctly without shell mode.
    const cmd = cp.spawn(vscodeExecutablePath, args, { env: fullEnv });

    return new Promise<number>((resolve, reject) => {
        cmd.stdout.on('data', (d: Buffer) => process.stdout.write(d));
        cmd.stderr.on('data', (d: Buffer) => process.stderr.write(d));
        cmd.on('error', (err: Error) => {
            console.log('Failed to spawn VS Code process: ' + err.toString());
        });

        let finished = false;
        function onProcessClosed(code: number | null, signal: string | null) {
            if (finished) {
                return;
            }
            finished = true;
            console.log(`Exit code:   ${code ?? signal}`);
            // fix: on windows, it seems like these descriptors can linger for an
            // indeterminate amount of time, causing the process to hang.
            cmd.stdout.destroy();
            cmd.stderr.destroy();
            if (code !== 0) {
                if (signal) {
                    reject(new Error(`Test run terminated by signal ${signal}`));
                } else {
                    reject(new Error(`Test run failed with exit code ${code}`));
                }
            } else {
                resolve(0);
            }
        }

        cmd.on('close', onProcessClosed);
        cmd.on('exit', onProcessClosed);
    });
}
