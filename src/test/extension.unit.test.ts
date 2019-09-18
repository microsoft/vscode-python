// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { parse } from 'semver';
import { extensions } from 'vscode';
import { buildApi } from '../client/api';
import { EXTENSION_ROOT_DIR, PVSC_EXTENSION_ID } from '../client/common/constants';

const expectedPath = `${EXTENSION_ROOT_DIR.fileToCommandArgument()}/pythonFiles/ptvsd_launcher.py`;

suite('Extension API Debugger', () => {
    test('Test debug launcher args (no-wait)', async () => {
        const args = await buildApi(Promise.resolve()).debug.getRemoteLauncherCommand('something', 1234, false);
        const expectedArgs = [expectedPath, '--default', '--host', 'something', '--port', '1234'];
        expect(args).to.be.deep.equal(expectedArgs);
    });
    test('Test debug launcher args (wait)', async () => {
        const args = await buildApi(Promise.resolve()).debug.getRemoteLauncherCommand('something', 1234, true);
        const expectedArgs = [expectedPath, '--default', '--host', 'something', '--port', '1234', '--wait'];
        expect(args).to.be.deep.equal(expectedArgs);
    });
});

suite('Extension version tests', () => {
    let version: string;

    setup(() => {
        const extension = extensions.getExtension(PVSC_EXTENSION_ID)!;
        version = parse(extension.packageJSON.version)!.raw;
    });

    test('If we are running a pipeline in the master branch, the extension version in `package.json` should have the "-dev" suffix', async function() {
        if (process.env.CI_BRANCH_NAME !== 'master') {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }

        return expect(version.endsWith('-dev'), 'When running a pipeline in the master branch, the extension version in package.json should have the -dev suffix').to.be.true;
    });

    test('If we are running a pipeline in the release branch, the extension version in `package.json` should not have the "-dev" suffix', async function() {
        if (process.env.CI_BRANCH_NAME !== 'release') {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }

        return expect(version.endsWith('-dev'), 'When running a pipeline in the release branch, the extension version in package.json should not have the -dev suffix').to.be.false;
    });
});
