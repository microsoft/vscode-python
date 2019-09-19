// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { buildApi } from '../client/api';
import { ApplicationEnvironment } from '../client/common/application/applicationEnvironment';
import { IApplicationEnvironment } from '../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';

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
    let applicationEnvironment: IApplicationEnvironment;
    const branchName = process.env.CI_BRANCH_NAME;

    suiteSetup(async function() {
        // Skip the entire suite if running locally
        if (!branchName) {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }
    });

    setup(() => {
        applicationEnvironment = new ApplicationEnvironment(undefined as any, undefined as any, undefined as any);
        version = applicationEnvironment.packageJson.version;
    });

    test('If we are running a pipeline in the master branch, the extension version in `package.json` should have the "-dev" suffix', async function() {
        if (branchName !== 'master') {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }

        return expect(version.endsWith('-dev'), 'When running a pipeline in the master branch, the extension version in package.json should have the -dev suffix').to.be.true;
    });

    test('If we are running a pipeline in the release branch, the extension version in `package.json` should not have the "-dev" suffix', async function() {
        if (!branchName!.startsWith('release')) {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }

        return expect(version.endsWith('-dev'), 'When running a pipeline in the release branch, the extension version in package.json should not have the -dev suffix').to.be.false;
    });
});
