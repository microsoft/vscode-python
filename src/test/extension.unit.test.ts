// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import * as path from 'path';
import { buildApi } from '../client/api';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';

const expectedPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'ptvsd_launcher.py');

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
