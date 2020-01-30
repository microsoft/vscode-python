// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Custom reporter to ensure Mocha process exits when we're done with tests.
// This is a hack, however for some reason the process running the tests do not exit.
// The hack is to force it to die when tests are done, if this doesn't work we've got a bigger problem on our hands.

// tslint:disable:no-var-requires no-require-imports no-any no-unnecessary-class no-default-export
import * as fs from 'fs-extra';
import * as net from 'net';
import * as path from 'path';
import { traceError, traceInfo, traceVerbose } from '../../client/common/logger';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../constants';
import { noop } from '../core';

let client: net.Socket | undefined;
const mochaTests: any = require('mocha');
const { EVENT_RUN_BEGIN, EVENT_RUN_END } = mochaTests.Runner.constants;

async function connectToServer() {
    const portFile = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'port.txt');
    if (!(await fs.pathExists(portFile))) {
        return;
    }
    const port = parseInt(await fs.readFile(portFile, 'utf-8'), 10);
    traceVerbose(`Need to connect to port ${port}`);
    return new Promise(resolve => {
        try {
            client = new net.Socket();
            client.connect({ port }, () => {
                traceVerbose(`Connected to port ${port}`);
                resolve();
            });
        } catch {
            traceError('Failed to connect to socket server to notify completion of tests');
            resolve();
        }
    });
}
function notifyCompleted(hasFailures: boolean) {
    if (!client || client.destroyed || !client.writable) {
        traceError('No client to write from');
        return;
    }
    try {
        const exitCode = hasFailures ? 1 : 0;
        traceVerbose(`Notify server of test completion with code ${exitCode}`);
        // If there are failures, send a code of 1 else 0.
        client.write(exitCode.toString());
        client.end();
        traceVerbose('Notified server of test completion');
    } catch (ex) {
        traceError('Socket client error', ex);
    }
}

class ExitReporter {
    constructor(runner: any) {
        traceVerbose('Initialize Exit Reporter for Mocha (PVSC).');
        connectToServer().catch(noop);
        const stats = runner.stats;
        runner
            .once(EVENT_RUN_BEGIN, () => {
                traceInfo('Start Exit Reporter for Mocha.');
            })
            .once(EVENT_RUN_END, async () => {
                notifyCompleted(stats.failures > 0);
                traceInfo('End Exit Reporter for Mocha.');
            });
    }
}

module.exports = ExitReporter;
