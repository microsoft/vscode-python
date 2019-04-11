// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Custom reporter to ensure Mocha process exits when we're done with tests.
// This is a hack, however for some reason the process running the tests do not exit.
// The hack is to force it to die when tests are done, if this doesn't work we've got a bigger problem on our hands.

// tslint:disable:no-var-requires no-require-imports no-any no-console no-unnecessary-class no-default-export
const log = require('why-is-node-running');
const mochaTests: any = require('mocha');
const { EVENT_RUN_BEGIN, EVENT_RUN_END } = mochaTests.Runner.constants;
class ExitReporter {
    constructor(runner: any) {
        console.log('Initialize Exit Reporter for Mocha (PVSC).');
        const stats = runner.stats;
        runner
            .once(EVENT_RUN_BEGIN, () => {
                console.info('Start Exit Reporter for Mocha.');
            })
            .once(EVENT_RUN_END, () => {
                process.stdout.cork();
                console.info('End Exit Reporter for Mocha.');
                process.stdout.write('If process does not die in 30s, then log and kill.');
                process.stdout.uncork();
                // NodeJs generally waits for pending timeouts, however the process running Mocha
                // No idea why it times, out. Once again, this is a hack.
                // Solution (i.e. hack), lets add a timeout with a delay of 30 seconds,
                // & if this process doesn't die, lets kill it.
                function die() {
                    setTimeout(() => {
                        console.info('Exiting from custom PVSC Mocha Reporter.');
                        try {
                            log();
                        } catch (ex) {
                            // Do nothing.
                        }
                        process.exit(stats.failures === 0 ? 0 : 1);
                        try {
                            // Lets just close VSC, hopefully that'll be sufficient (more graceful).
                            const vscode = require('vscode');
                            vscode.commands.executeCommand('workbench.action.closeWindow');
                        } catch (ex) {
                            // Do nothing.
                        }
                    }, 30000);
                }
                die();
            });
    }
}

module.exports = ExitReporter;
