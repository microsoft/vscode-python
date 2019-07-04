// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import * as sinon from 'sinon';
import { buildApi } from '../client/api';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';

const expectedPath = `${EXTENSION_ROOT_DIR.fileToCommandArgument()}/pythonFiles/ptvsd_launcher.py`;

// Stub sourceMapSupport.initialize before we import from extension.ts
// (it's called at the top of the file but we don't need it here)
// tslint:disable-next-line: no-require-imports no-var-requires
const sourceMapSupport = require('../client/sourceMapSupport');
sinon.stub(sourceMapSupport, 'initialize');
import { MULTILINE_SEPARATOR_INDENT_REGEX } from '../client/extension';

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
    test('Multiline separator indent regex should not pick up strings with no multiline separator', async () => {
        const result = MULTILINE_SEPARATOR_INDENT_REGEX.test('a = "test"');
        expect (result).to.be.equal(false, 'Multiline separator indent regex for regular strings should not have matches');
    });
    test('Multiline separator indent regex should not pick up strings with escaped characters', async () => {
        const result = MULTILINE_SEPARATOR_INDENT_REGEX.test('a = \'hello \\n\'');
        expect (result).to.be.equal(false, 'Multiline separator indent regex for strings with escaped characters should not have matches');
    });
    test('Multiline separator indent regex should pick up strings ending with a multiline separator', async () => {
        const result = MULTILINE_SEPARATOR_INDENT_REGEX.test('a = \'multiline \\');
        expect (result).to.be.equal(true, 'Multiline separator indent regex for strings with newline separator should have matches');
    });
});
