// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { DebuggerLauncherScriptProvider, NoDebugLauncherScriptProvider } from '../../client/debugger/DebugClients/launcherProvider';

suite('Debugger - Launcher Script Provider', () => {
    test('Ensure debugger gets the launcher from PythonTools directory', () => {
        const launcherPath = new DebuggerLauncherScriptProvider().getLauncherFilePath();
        const expectedPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
        expect(launcherPath).to.be.equal(expectedPath);
        console.log(launcherPath);
        console.log(EXTENSION_ROOT_DIR);
        const files = fs.readdirSync(path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental'), 'utf8');
        files.forEach(item => {
            console.log(item);
            const file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', item);
            console.log(file);
            console.log(fs.existsSync(file));
        });
        expect(fs.existsSync(launcherPath)).to.be.equal(true, 'file does not exist');
    });
    test('Ensure debugger gets the non debug launcher from PythonTools directory', () => {
        const launcherPath = new NoDebugLauncherScriptProvider().getLauncherFilePath();
        const expectedPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
        expect(launcherPath).to.be.equal(expectedPath);
        expect(fs.existsSync(launcherPath)).to.be.equal(true, 'file does not exist');
    });
});
