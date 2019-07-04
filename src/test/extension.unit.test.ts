// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import * as sinon from 'sinon';
import { buildApi } from '../client/api';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';

// Stub sourceMapSupport.initialize before we import from extension.ts (we don't actually need it)
// tslint:disable-next-line: no-require-imports no-var-requires
const sourceMapSupport = require('../client/sourceMapSupport');
sinon.stub(sourceMapSupport, 'initialize');
import { DECREASE_INDENT_REGEX, INCREASE_INDENT_REGEX } from '../client/extension';

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
    [
        {
            keyword: 'def',
            line: 'def foo:',
            dedent: false
        },
        {
            keyword: 'class',
            line: 'class TestClass:',
            dedent: false
        },
        {
            keyword: 'for',
            line: 'for item in items:',
            dedent: false
        },
        {
            keyword: 'if',
            line: 'if foo is None:',
            dedent: false
        },
        {
            keyword: 'elif',
            line: 'elif x < 5:',
            dedent: true
        },
        {
            keyword: 'else',
            line: 'else:',
            dedent: true
        },
        {
            keyword: 'while',
            line: 'while \'::\' in macaddress:',
            dedent: false
        },
        {
            keyword: 'try',
            line: 'try:',
            dedent: false
        },
        {
            keyword: 'with',
            line: 'with self.test:',
            dedent: false
        },
        {
            keyword: 'finally',
            line: 'finally:',
            dedent: false
        },
        {
            keyword: 'except',
            line: 'except TestError:',
            dedent: false
        },
        {
            keyword: 'async',
            line: 'async def test(self):',
            dedent: false
        }
    ].forEach(({keyword, line, dedent}) => {
        test(`Increase indent regex should pick up lines containing the ${keyword} keyword`, async () => {
            const result = INCREASE_INDENT_REGEX.test(line);
            expect(result).to.be.equal(true, `Increase indent regex should pick up lines containing the ${keyword} keyword`);
        });

        test(`Decrease indent regex should ${dedent ? '' : 'not '}pick up lines containing the ${keyword} keyword`, async () => {
            const result = DECREASE_INDENT_REGEX.test(line);
            expect(result).to.be.equal(dedent, `Decrease indent regex should ${dedent ? '' : 'not '}pick up lines containing the ${keyword} keyword`);
        });
    });
    test('Increase indent regex should not pick up lines without keywords', async () => {
        const result = INCREASE_INDENT_REGEX.test('a = \'hello \\n \'');
        expect(result).to.be.equal(false, 'Increase indent regex should not pick up lines without keywords');
    });
    test('Decrease indent regex should not pick up lines without keywords', async () => {
        const result = DECREASE_INDENT_REGEX.test('a = \'hello \\n \'');
        expect(result).to.be.equal(false, 'Decrease indent regex should not pick up lines without keywords');
    });
});
