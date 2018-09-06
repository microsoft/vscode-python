// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { noop } from '../../utils/misc';

export class DebugClientEx extends DebugClient {
    private adapterProcess: ChildProcess | undefined;
    constructor(private executable: string, debugType: string, private coverageDirectory: string, private spawnOptions?: SpawnOptions) {
        super('node', '', debugType, spawnOptions);
    }
    /**
     * Starts a new debug adapter and sets up communication via stdin/stdout.
     * If a port number is specified the adapter is not launched but a connection to
     * a debug adapter running in server mode is established. This is useful for debugging
     * the adapter while running tests. For this reason all timeouts are disabled in server mode.
     */
    public start(port?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const runtime = path.join(EXTENSION_ROOT_DIR, 'node_modules', '.bin', 'istanbul');
            const args = ['cover', '--report=json', '--print=none', `--dir=${this.coverageDirectory}`, '--handle-sigint', this.executable];
            this.adapterProcess = spawn(runtime, args, this.spawnOptions);
            this.adapterProcess.stderr.on('data', noop);
            this.adapterProcess.on('error', (err) => {
                console.error(err);
                reject(err);
            });
            this.adapterProcess.on('exit', noop);
            this.connect(this.adapterProcess.stdout, this.adapterProcess.stdin);
            resolve();
        });
    }
    public stop(): Promise<void> {
        return this.disconnectRequest().then(this.stopAdapterProcess).catch(this.stopAdapterProcess);
    }
    private stopAdapterProcess = () => {
        if (this.adapterProcess) {
            this.adapterProcess.kill();
            this.adapterProcess = undefined;
        }
    }
}
