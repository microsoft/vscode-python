// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import { DebuggerLauncherScriptProvider, NoDebugLauncherScriptProvider, RemoteDebuggerLauncherScriptProvider } from '../../../../client/debugger/debugAdapter/DebugClients/launcherProvider';

const expectedPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd_launcher.py');

suite('Debugger - Launcher Script Provider', () => {
    test('Ensure launcher script exists', async () => {
        expect(await fs.pathExists(expectedPath)).to.be.deep.equal(true, 'Debugger launcher script does not exist');
    });
    test('Test debug launcher args', async () => {
        const args = new DebuggerLauncherScriptProvider().getLauncherArgs({ host: 'something', port: 1234 });
        const expectedArgs = [expectedPath, '--client', '--host', 'something', '--port', '1234'];
        expect(args).to.be.deep.equal(expectedArgs);
    });
    test('Test non-debug launcher args', async () => {
        const args = new NoDebugLauncherScriptProvider().getLauncherArgs({ host: 'something', port: 1234 });
        const expectedArgs = [expectedPath, '--nodebug', '--client', '--host', 'something', '--port', '1234'];
        expect(args).to.be.deep.equal(expectedArgs);
    });
    test('Test remote debug launcher args (and do not wait for debugger to attach)', async () => {
        const args = new RemoteDebuggerLauncherScriptProvider().getLauncherArgs({ host: 'something', port: 1234, waitUntilDebuggerAttaches: false });
        const expectedArgs = [expectedPath, '--host', 'something', '--port', '1234'];
        expect(args).to.be.deep.equal(expectedArgs);
    });
    test('Test remote debug launcher args (and wait for debugger to attach)', async () => {
        const args = new RemoteDebuggerLauncherScriptProvider().getLauncherArgs({ host: 'something', port: 1234, waitUntilDebuggerAttaches: true });
        const expectedArgs = [expectedPath, '--host', 'something', '--port', '1234', '--wait'];
        expect(args).to.be.deep.equal(expectedArgs);
    });
});
