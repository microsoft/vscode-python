// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { extensionRootPath } from '../constants';

// tslint:disable: no-console

/**
 * Gets the path to the bootstrap extension.
 *
 * @export
 * @returns
 */
export async function getExtensionPath() {
    const sourceDir = path.join(extensionRootPath, 'src', 'smoke', 'bootstrap');
    const extensionPath = path.join(sourceDir, 'bootstrap.vsix');
    if (await fs.pathExists(extensionPath)) {
        console.info(`Reusing existing bootstrap extension ${extensionPath}`);
        return extensionPath;
    }
    return new Promise<string>((resolve, reject) => {
        console.info(`Building bootstrap extension ${extensionPath}`);
        const args = ['vsce', 'package', '--out', extensionPath];
        const result = spawnSync('npx', args, { cwd: path.join(sourceDir, 'extension') });
        const stdErr = (result.stderr || '').toString().trim();
        if (stdErr.length > 0) {
            return reject(new Error(`Failed to build bootstrap extension. Error: ${result.stderr.toString()}`));
        }
        console.info(`Built bootstrap extension ${extensionPath}`);
        resolve(extensionPath);
    });
}
