// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import * as fs from 'fs-extra';
import { createServer, Server } from 'net';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../client/constants';
import { noop, sleep } from './core';

// tslint:disable:no-console

const testFile = process.argv[2];
let proc: ChildProcess | undefined;
let server: Server | undefined;
async function end(exitCode: number) {
    if (exitCode === 0) {
        console.log('Exiting without errors');
    } else {
        console.error('Exiting with test failures');
    }
    if (proc) {
        try {
            const procToKill = proc;
            proc = undefined;
            console.log('Killing VSC');
            // Wait for the std buffers to get flushed before killing.
            await sleep(5_000);
            procToKill.kill();
        } catch {
            noop();
        }
    }
    if (server) {
        server.close();
    }
    // Exit with required code.
    process.exit(exitCode);
}

async function startSocketServer() {
    return new Promise(resolve => {
        server = createServer(socket => {
            socket.on('data', buffer => {
                const data = buffer.toString('utf8');
                console.log(`Exit code from Tests is ${data}`);
                const code = parseInt(data.substring(0, 1), 10);
                end(code).catch(noop);
            });
        });

        server.listen({ host: '127.0.0.1', port: 0 }, async () => {
            const port = server!.address().port;
            console.log(`Test server listening on port ${port}`);
            const portFile = path.join(EXTENSION_ROOT_DIR, 'port.txt');
            if (await fs.pathExists(portFile)) {
                await fs.unlink(portFile);
            }

            await fs.writeFile(portFile, port.toString());
            resolve();
        });
    });
}

async function start() {
    await startSocketServer();
    const options: SpawnOptions = { cwd: process.cwd(), env: process.env, detached: true, stdio: 'inherit' };
    proc = spawn(process.execPath, [testFile], options);
    proc.once('close', end);
}

start().catch(ex => console.error(ex));
