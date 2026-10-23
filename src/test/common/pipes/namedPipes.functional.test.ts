// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as cp from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

suite('POSIX named pipe reader', () => {
    suiteSetup(function () {
        if (process.platform === 'win32') {
            this.skip();
        }
    });

    for (const scenario of ['close', 'error']) {
        test(`preserves a reused descriptor after socket ${scenario}`, async () => {
            const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'python-test-fifo-'));
            try {
                // Isolate descriptor reuse from the test runner's own file descriptors.
                await promisify(cp.execFile)(
                    process.execPath,
                    [
                        '--require',
                        path.join(__dirname, '../../unittests.js'),
                        path.join(__dirname, 'namedPipesFixture.js'),
                        directory,
                        scenario,
                    ],
                    { timeout: 10_000 },
                );
            } finally {
                await fs.remove(directory);
            }
        });
    }
});
