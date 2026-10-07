// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fs from 'fs/promises';
import Mocha from 'mocha';
import * as os from 'os';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';

const CIReporter = require('../../../build/ci/scripts/ci_reporter');

suite('CI reporter', () => {
    let directory: string;
    let originalMochaFile: string | undefined;

    setup(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'python-ci-reporter-'));
        originalMochaFile = process.env.MOCHA_FILE;
        process.env.MOCHA_FILE = path.join(directory, 'environment.xml');
    });

    teardown(async () => {
        if (originalMochaFile === undefined) {
            delete process.env.MOCHA_FILE;
        } else {
            process.env.MOCHA_FILE = originalMochaFile;
        }
        await fs.rm(directory, { recursive: true, force: true });
    });

    async function runTests(output?: string, consoleReporter?: string) {
        const mocha = new Mocha({ reporter: CIReporter, reporterOptions: { output, consoleReporter } });
        const tests = Mocha.Suite.create(mocha.suite, 'Reporter & XML');
        tests.addTest(new Mocha.Test('passes', () => undefined));
        tests.addTest(
            new Mocha.Test('fails', () => {
                throw new Error('expected <failure>');
            }),
        );
        tests.addTest(new Mocha.Test('pending'));
        const failures = await new Promise<number>((resolve) => mocha.run(resolve));
        assert.strictEqual(failures, 1);
        return parseStringPromise(await fs.readFile(output || process.env.MOCHA_FILE!, 'utf8'));
    }

    test('writes passing, failing, and pending results before completion to MOCHA_FILE', async () => {
        const { testsuite } = await runTests();
        assert.strictEqual(testsuite.$.tests, '3');
        assert.strictEqual(testsuite.$.errors, '1');
        assert.strictEqual(testsuite.$.skipped, '1');
        assert.strictEqual(testsuite.testcase[0].$.classname, 'Reporter & XML');
        assert.strictEqual(testsuite.testcase[0].$.name, 'passes');
        assert.ok(testsuite.testcase[1].failure[0].includes('expected <failure>'));
        assert.ok(testsuite.testcase[2].skipped);
    });

    test('uses an explicit output path instead of MOCHA_FILE', async () => {
        const output = path.join(directory, 'nested', 'explicit.xml');
        await runTests(output);
        await assert.rejects(fs.access(process.env.MOCHA_FILE!));
    });

    test('supports the extension test completion reporter', async () => {
        await runTests(undefined, path.join(__dirname, 'exitCIAfterTestReporter'));
    });
});
