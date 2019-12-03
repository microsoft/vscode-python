// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as cp from 'child_process';
import * as path from 'path';
import * as yargs from 'yargs';
import { sleep } from './helpers';
import { info, initialize } from './helpers/logger';
import { mergeAndgenerateHtmlReport } from './helpers/report';
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
    default: false,
    boolean: true
};

// tslint:disable-next-line: no-unused-expression
const parsedArgs = yargs
    .command({
        command: 'download',
        describe: 'Downloads VS Code',
        builder: (args: yargs.Argv) =>
            args
                .option('channel', channelOption)
                .option('destination', destinationOption)
                .option('verbose', enableVerboseLogging),
        handler: async argv => {
            initialize(argv.verbose);
            downloadVSCode(argv.channel, path.resolve(argv.destination)).catch(console.error);
        }
    })
    .command({
        command: 'install',
        describe: 'Installs the extensions into VS Code',
        builder: (args: yargs.Argv) =>
            args
                .option('channel', channelOption)
                .option('destination', destinationOption)
                .option('verbose', enableVerboseLogging)
                .option('vsix', {
                    describe: 'Path to Python Extension',
                    default: './ms-python-insiders.vsix'
                }),
        handler: async argv => {
            initialize(argv.verbose);
            await installExtensions(argv.channel, path.resolve(argv.destination), path.resolve(argv.vsix));
        }
    })
    .command({
        command: 'launch',
        describe: 'Launches VS Code',
        builder: (args: yargs.Argv) =>
            args
                .option('channel', channelOption)
                .option('destination', destinationOption)
                .option('verbose', enableVerboseLogging)
                .option('timeout', {
                    alias: 't',
                    describe: 'Timeout (ms) before closing VS Code',
                    default: 5 * 60 * 1_000
                }),
        handler: async argv => {
            initialize(argv.verbose);
            const options = getTestOptions(argv.channel, path.resolve(argv.destination), 'python', argv.verbose);
            const app = new Application(options);
            info(app.channel);
            await (app.options as TestOptions).initilize();
            await app
                .start()
                .then(() => info('VS Code successfully launched'))
                .catch(console.error.bind(console, 'Failed to launch VS Code'));
            await waitForPythonExtensionToActivate(60_000, app);
            await sleep(100_000);
            await app.quickopen.runCommand('View: Close Editor');
        }
    })
    .command({
        command: 'test',
        describe: "Runs the UI Tests (Arguments after '--' are cucumberjs args)",
        builder: (args: yargs.Argv) =>
            args
                .option('channel', channelOption)
                .option('destination', destinationOption)
                .option('verbose', enableVerboseLogging)
                .option('pythonPath', {
                    describe: 'Destination for download path',
                    default: process.env.CI_PYTHON_PATH || 'python'
                })
                .example('test', '                                      # (Runs all tests in stable)')
                .example('test', '--channel=insider                     # (Runs all tests in insiders)')
                .example('test', '--channel=insider --pythonPath=c:/python/python.exe   # (Runs all tests in insiders)')
                .example('test', "-- --tags=@wip                        # (Runs tests in stable with with tags @wip. Arguments after '--' are cucumberjs args.)")
                .example('test', "-- --tags='@smoke and @terminal'      # (Runs tests in stable with tags '@smoke and @terminal')"),
        handler: async argv => {
            initialize(argv.verbose);
            const cucumberArgs = argv._.slice(1);
            const pythonPath =
                argv.pythonPath === 'python'
                    ? cp
                          .execSync('python -c "import sys;print(sys.executable)"')
                          .toString()
                          .trim()
                    : argv.pythonPath;
            await start(argv.channel, path.resolve(argv.destination), argv.verbose, pythonPath, cucumberArgs).catch(ex => {
                console.error('UI Tests Failed', ex);
                process.exit(1); // Required for CLI to fail on CI servers.
            });
        }
    })
    .command({
        command: 'report',
        describe: 'Merges multiple cucumber JSON reports and generates a single HTML report',
        builder: (args: yargs.Argv) =>
            args
                .option('jsonDir', {
                    describe: 'Directory containing the Cucumber JSON reports',
                    demandOption: true
                })
                .option('htmlOutput', {
                    describe: 'Target directory for HTML report',
                    default: path.join(process.cwd(), '.vscode test', 'reports')
                }),
        handler: argv => mergeAndgenerateHtmlReport(argv.jsonDir as string, argv.htmlOutput)
    })
    .command({
        command: 'steps',
        describe: 'List all of the Steps (with arguments and all usages)',
        builder: (args: yargs.Argv) =>
            args
                .option('format', {
                    describe: 'Where should the steps be displayed as plain text or JSON',
                    default: 'text',
                    choices: ['text', 'json']
                })
                .option('file', {
                    describe: 'Whether to print output to a file'
                })
                .example('steps', '# Lists all steps'),
        handler: argv => {
            console.log('test', argv);
        }
    })
    .demandCommand()
    .help()
    .version(false).argv;

// argv needs to be retained by compiler.
// Hence we need a bogus use of the .argv value.
if (parsedArgs._.length === 0) {
    console.log(parsedArgs);
}
