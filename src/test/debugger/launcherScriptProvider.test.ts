// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { DebuggerLauncherScriptProvider, DebuggerV2LauncherScriptProvider, NoDebugLauncherScriptProvider } from '../../client/debugger/DebugClients/launcherProvider';

suite('Debugger - Launcher Script Provider', () => {
    test('Ensure stable debugger gets the old launcher from PythonTools directory', () => {
        const launcherPath = new DebuggerLauncherScriptProvider().getLauncherFilePath();
        const expectedPath = path.join(path.dirname(__dirname), '..', '..', 'pythonFiles', 'PythonTools', 'visualstudio_py_launcher.py');
        expect(launcherPath).to.be.equal(expectedPath);
        expect(fs.existsSync(launcherPath)).to.be.equal(true, 'file does not exist');
    });
    test('Ensure stable debugger when not debugging gets the non debnug launcher from PythonTools directory', () => {
        const launcherPath = new NoDebugLauncherScriptProvider().getLauncherFilePath();
        const expectedPath = path.join(path.dirname(__dirname), '..', '..', 'pythonFiles', 'PythonTools', 'visualstudio_py_launcher_nodebug.py');
        expect(launcherPath).to.be.equal(expectedPath);
        expect(fs.existsSync(launcherPath)).to.be.equal(true, 'file does not exist');
    });
    test('Ensure experimental debugger gets the new launcher from experimentals directory', () => {
        const launcherPath = new DebuggerV2LauncherScriptProvider().getLauncherFilePath();
        const expectedPath = path.join(path.dirname(__dirname), '..', '..', 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
        expect(launcherPath).to.be.equal(expectedPath);
        expect(fs.existsSync(launcherPath)).to.be.equal(true, 'file does not exist');
    });
});
