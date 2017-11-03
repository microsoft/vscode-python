/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { execPythonFile } from '../../client/common/utils';
import { getFirstNonEmptyLineFromMultilineString } from '../../client/interpreter/helpers';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { initialize, initializeTest } from '../initialize';

use(chaiAsPromised);

suite('Interpreters display version', () => {
    const interpreterVersion = new InterpreterVersionService();
    suiteSetup(initialize);
    setup(initializeTest);

    test('Must return the Python Version', async () => {
        const output = await execPythonFile(undefined, 'python', ['--version'], __dirname, true);
        const version = getFirstNonEmptyLineFromMultilineString(output);
        const pyVersion = await interpreterVersion.getVersion('python', 'DEFAULT_TEST_VALUE');
        assert.equal(pyVersion, version, 'Incorrect version');
    });
    test('Must return the default value when Python path is invalid', async () => {
        const pyVersion = await interpreterVersion.getVersion('INVALID_INTERPRETER', 'DEFAULT_TEST_VALUE');
        assert.equal(pyVersion, 'DEFAULT_TEST_VALUE', 'Incorrect version');
    });
    test('Must return the Pip Version', async () => {
        const output = await execPythonFile(undefined, 'python', ['-m', 'pip', '--version'], __dirname, true);
        const versionInfo = getFirstNonEmptyLineFromMultilineString(output);

        // Take the second part, see below example.
        // pip 9.0.1 from /Users/donjayamanne/anaconda3/lib/python3.6/site-packages (python 3.6).
        const parts = versionInfo.split(' ');

        const pipVersionPromise = interpreterVersion.getPipVersion('python');
        await expect(pipVersionPromise).to.eventually.equal(parts[1].trim());
    });
    test('Must throw an exceptionn when Pip version cannot be determine', async () => {
        const pipVersionPromise = interpreterVersion.getPipVersion('INVALID_INTERPRETER');
        await expect(pipVersionPromise).to.be.rejectedWith();
    });
});
