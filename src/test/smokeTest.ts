// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-console no-require-imports no-var-requires

import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';
import { unzip } from './common';

const del = require('del');

const tmpFolder = path.join(EXTENSION_ROOT_DIR, 'tmp');
const publishedExtensionPath = path.join(tmpFolder, 'ext', 'testReleaseExtensionsFolder');

class TestRunner {
    public async start() {
        await del([path.join(tmpFolder, '**')]);
        await this.extractLatestExtension(publishedExtensionPath);

        await this.enableLanguageServer(false);
        await this.launchSmokeTests();
    }
    private async enableLanguageServer(enable: boolean) {
        const settings = `{ "python.jediEnabled": ${!enable} }`;
        await fs.writeFile(path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'smokeTests'), settings);
    }

    private async  launchSmokeTests() {
        const env: { [key: string]: {} } = {
            VSCC_PYTHON_SMOKE_TEST: true,
            CODE_EXTENSIONS_PATH: publishedExtensionPath
        };

        await this.launchTest(env);
    }
    private async  launchTest(customEnvVars: { [key: string]: {} }) {
        await new Promise((resolve, reject) => {
            const env: { [key: string]: {} } = {
                TEST_FILES_SUFFIX: 'smoke.test',
                CODE_TESTS_WORKSPACE: path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'smokeTests'),
                ...process.env,
                ...customEnvVars
            };

            const proc = spawn('node', [path.join(__dirname, 'standardTest.js')], { cwd: EXTENSION_ROOT_DIR, env });
            proc.stdout.pipe(process.stdout);
            proc.stderr.pipe(process.stderr);
            proc.on('error', reject);
            proc.on('close', code => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(`Failed with code ${code}.`);
                }
            });
        });
    }

    private async extractLatestExtension(targetDir: string): Promise<void> {
        const extensionFile = await new Promise<string>((resolve, reject) => glob('*.vsix', (ex, files) => ex ? reject(ex) : resolve(files[0])));
        await unzip(extensionFile, targetDir);
    }
}

new TestRunner().start().catch(ex => console.error('Error in running Performance Tests', ex));
