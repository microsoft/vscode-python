// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import * as util from 'util';
import { extensionRootPath } from './constants';
import { noop } from './helpers';
import { debug } from './helpers/logger';
import { getTestOptions } from './setup';
import { WorldParameters } from './steps/types';
import { Channel } from './types';

// tslint:disable-next-line: no-var-requires no-require-imports
const Cli = require('cucumber/lib/cli');

export async function initialize(channel: Channel, testDir: string, verboseLogging: boolean) {
    const options = getTestOptions(channel, testDir, 'pythonPath', verboseLogging);
    // Delete all old test related stuff.
    debug('Deleting old test data');
    await Promise.all([
        fs.remove(options.tempPath).catch(noop),
        fs.remove(options.reportsPath).catch(noop),
        fs.remove(options.logsPath).catch(noop),
        fs.remove(options.screenshotsPath).catch(noop),
        fs.remove(options.userDataPath).catch(noop)
    ]);
}

export async function start(channel: Channel, testDir: string, verboseLogging: boolean, cucumberArgs: string[]) {
    await initialize(channel, testDir, verboseLogging);

    const worldParameters: WorldParameters = { channel, testDir, verboseLogging };
    const args: string[] = [
        '', // Leave empty (not used by cucmberjs)
        '', // Leave empty (not used by cucmberjs)
        'src/uitests/features',
        '--require-module', 'source-map-support/register',
        '-r', 'out/uitests/src/steps/**/*.js',
        '--format', 'node_modules/cucumber-pretty',
        '--world-parameters', JSON.stringify(worldParameters),
        ...cucumberArgs
    ];
    const cli = new Cli.default({ argv: args, cwd: extensionRootPath, stdout: process.stdout });
    const result = await cli.run().catch(console.error);
    if (!result.success) {
        throw new Error(`Error in running UI Tests. ${util.format(result)}`);
    }
}
