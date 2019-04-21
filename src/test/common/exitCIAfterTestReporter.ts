// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Custom reporter to ensure Mocha process exits when we're done with tests.
// This is a hack, however for some reason the process running the tests do not exit.
// The hack is to force it to die when tests are done, if this doesn't work we've got a bigger problem on our hands.

// tslint:disable:no-var-requires no-require-imports no-any no-console no-unnecessary-class no-default-export
import * as fs from 'fs-extra';
import * as net from 'net';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
const log = require('why-is-node-running');
const mochaTests: any = require('mocha');
const { EVENT_RUN_BEGIN, EVENT_RUN_END } = mochaTests.Runner.constants;

async function notifyCompleted(hasFailures: boolean): Promise<void> {
    const portFile = path.join(EXTENSION_ROOT_DIR, 'port.txt');
    if (!(await fs.pathExists(portFile))) {
        return;
    }
    const port = parseInt(await fs.readFile(portFile, 'utf-8'), 10);
    return new Promise(resolve => {
        const client = new net.Socket();
        client.connect({ port }, () => {
            // If there are failures, send a code of 1 else 0.
            client.write(hasFailures ? '1' : 0);
            client.destroy();
            resolve();
        });
    });
}

class ExitReporter {
    constructor(runner: any) {
        console.log('Initialize Exit Reporter for Mocha (PVSC).');
        const stats = runner.stats;
        runner
            .once(EVENT_RUN_BEGIN, () => {
                console.info('Start Exit Reporter for Mocha.');
            })
            .once(EVENT_RUN_END, async () => {
                process.stdout.cork();
                console.info('End Exit Reporter for Mocha.');
                process.stdout.write('If process does not die in 30s, then log and kill.');
                process.stdout.uncork();

                await notifyCompleted(stats.failures > 0);

                // NodeJs generally waits for pending timeouts, however the process running Mocha
                // No idea why it times, out. Once again, this is a hack.
                // Solution (i.e. hack), lets add a timeout with a delay of 30 seconds,
                // & if this process doesn't die, lets kill it.
                function die() {
                    process.stdout.cork();
                    console.info('Exiting from custom PVSC Mocha Reporter.');
                    process.stdout.write('If process does not die in 30s, then log and kill.');
                    process.stdout.uncork();
                    try {
                        log();
                    } catch (ex) {
                        // Do nothing.
                    }
                    try {
                        // Lets just close VSC, hopefully that'll be sufficient (more graceful).
                        const vscode = require('vscode');
                        vscode.commands.executeCommand('workbench.action.closeWindow');
                    } catch (ex) {
                        // Do nothing.
                    }
                }
                die();
            });
    }
}

module.exports = ExitReporter;
