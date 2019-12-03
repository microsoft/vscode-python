// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { uitestsRootPath } from '../constants';
import { debug } from '../helpers/logger';

/**
 * Gets the path to the bootstrap extension.
 *
 * @export
 * @returns
 */
export async function getExtensionPath() {
    const sourceDir = path.join(uitestsRootPath, 'bootstrap');
    const extensionPath = path.join(sourceDir, 'bootstrap.vsix');
    if (await fs.pathExists(extensionPath)) {
        debug(`Reusing existing bootstrap extension ${extensionPath}`);
        return extensionPath;
    }
    return new Promise<string>((resolve, reject) => {
        debug(`Building bootstrap extension ${extensionPath}`);
        const args = ['vsce', 'package', '--out', extensionPath];
        const result = spawnSync('npx', args, { cwd: path.join(sourceDir, 'extension') });
        const stdErr = (result.stderr || '').toString().trim();
        if (stdErr.length > 0) {
            return reject(new Error(`Failed to build bootstrap extension. Error: ${result.stderr.toString()}`));
        }
        debug(`Built bootstrap extension ${extensionPath}`);
        resolve(extensionPath);
    });
}
