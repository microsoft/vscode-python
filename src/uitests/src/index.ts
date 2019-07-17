// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as yargs from 'yargs';
import { sleep } from './helpers';
import { info } from './helpers/logger';
import { downloadVSCode, getTestOptions, installExtensions, TestOptions, waitForPythonExtensionToActivate } from './setup';
import { start } from './testRunner';
import { Channel } from './types';
import { Application } from './vscode';

// tslint:disable: no-console

const channels: Channel[] = ['insider', 'stable'];
const channelOption = {
    describe: 'VS Code Channel',
    default: 'stable' as Channel,
    choices: channels
};
const destinationOption = {
    describe: 'Destination for download path',
    default: './.vscode test'
};
const enableVerboseLogging = {
    describe: 'Enable verbose (debug) logging',
    default: false
};

// tslint:disable-next-line: no-unused-expression
const parsedArgs = yargs
    .command({
        command: 'download',
        describe: 'Downloads VS Code',
        builder: (args: yargs.Argv) => args
            .option('channel', channelOption)
            .option('destination', destinationOption)
            .option('verbose', enableVerboseLogging),
        handler: (argv) => downloadVSCode(argv.channel, path.resolve(argv.destination)).catch(console.error)
    })
    .command({
        command: 'install',
        describe: 'Installs the extensions into VS Code',
        builder: (args: yargs.Argv) => args
            .option('channel', channelOption)
            .option('destination', destinationOption)
            .option('vsix', {
                describe: 'Path to Python Extension',
                default: './ms-python-insiders.vsix'
            }),
        handler: (argv) => installExtensions(argv.channel, path.resolve(argv.destination), path.resolve(argv.vsix))
    })
    .command({
        command: 'launch',
        describe: 'Launches VS Code',
        builder: (args: yargs.Argv) => args
            .option('channel', channelOption)
            .option('destination', destinationOption)
            .option('verbose', enableVerboseLogging)
            .option('timeout', {
                alias: 't',
                describe: 'Timeout (ms) before closing VS Code',
                default: 5 * 60 * 1_000
            }),
        handler: async (argv) => {
            const options = getTestOptions(argv.channel, path.resolve(argv.destination), 'python', argv.verbose);
            const app = new Application(options);
            info(app.channel);
            await (app.options as TestOptions).initilize();
            await app.start()
                .then(() => info('VS Code successfully launched'))
                .catch(console.error.bind(console, 'Failed to launch VS Code'));
            await waitForPythonExtensionToActivate(60_000, app);
            await sleep(100_000);
            await app.quickopen.runCommand('View: Close Editor');
        }
    })
    .command({
        command: 'test',
        describe: 'Runs the UI Tests (Arguments after \'--\' are cucumberjs args)',
        builder: (args: yargs.Argv) => args
            .option('channel', channelOption)
            .option('destination', destinationOption)
            .option('verbose', enableVerboseLogging)
            .example('test', '                                      # (Runs all tests in stable)')
            .example('test', '--channel=insider                     # (Runs all tests in insiders)')
            .example('test', '-- --tags=@wip                        # (Runs tests in stable with with tags @wip. Arguments after \'--\' are cucumberjs args.)')
            .example('test', '-- --tags=\'@smoke and @terminal\'      # (Runs tests in stable with tags \'@smoke and @terminal\')'),
        handler: async (argv) => {
            const cucumberArgs = argv._.slice(1);
            await start(argv.channel, path.resolve(argv.destination), argv.verbose, cucumberArgs)
                .catch(ex => {
                    console.error('Failed to launch UI Tests', ex);
                    process.exit(1); // Required for CLI to fail on CI servers.
                });
        }
    })
    .command({
        command: 'steps',
        describe: 'List all of the Steps (with arguments and all usages)',
        builder: (args: yargs.Argv) => args
            .option('format', {
                describe: 'Where should the steps be displayed as plain text or JSON',
                default: 'text',
                choices: ['text', 'json']
            })
            .option('file', {
                describe: 'Whether to print output to a file'
            })
            .example('steps', '# Lists all steps'),
        handler: (argv) => {
            console.log('test', argv);
        }
    })
    .demandCommand()
    .help()
    .version(false)
    .argv;

// argv needs to be retained by compiler.
// Hence we need a bogus use of the .argv value.
if (parsedArgs._.length === 0) {
    console.log(parsedArgs);
}
