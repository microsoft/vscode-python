// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import {
    DEFAULT_AUTO_TEST_DISCOVER_ON_SAVE_PATTERN,
    matchesAutoTestDiscoverOnSavePattern,
    resolveAutoTestDiscoverOnSavePattern,
} from '../../../client/testing/configuration/autoTestDiscoverOnSavePattern';

suite('autoTestDiscoverOnSavePattern', () => {
    const pyFile = '/workspace/pkg/app.py';
    const testFile = '/workspace/pkg/test_app.py';
    const suffixTestFile = '/workspace/pkg/app_test.py';
    const readme = '/workspace/pkg/readme.md';

    test('default pattern matches Python files only', () => {
        assert.strictEqual(
            matchesAutoTestDiscoverOnSavePattern(pyFile, DEFAULT_AUTO_TEST_DISCOVER_ON_SAVE_PATTERN),
            true,
        );
        assert.strictEqual(
            matchesAutoTestDiscoverOnSavePattern(readme, DEFAULT_AUTO_TEST_DISCOVER_ON_SAVE_PATTERN),
            false,
        );
    });

    test('legacy string pattern still matches the absolute path', () => {
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(pyFile, '**/*.py'), true);
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(readme, '**/*.py'), false);
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(pyFile, '   '), false);
    });

    test('enabled object patterns are combined and disabled patterns are ignored', () => {
        const pattern = {
            '**/*.py': false,
            '**/test_*.py': true,
            '**/*_test.py': true,
            '**/generated/**': false,
        };

        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(pyFile, pattern), false);
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(testFile, pattern), true);
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(suffixTestFile, pattern), true);
        // A false pattern does not exclude a file matched by a different enabled pattern.
        assert.strictEqual(
            matchesAutoTestDiscoverOnSavePattern('/workspace/generated/test_foo.py', {
                '**/*.py': true,
                '**/generated/**': false,
            }),
            true,
        );
    });

    test('a merged object keeps a narrower-scope override of the same pattern', () => {
        // User `**/*.py: true` overridden by workspace `**/*.py: false`, plus a workspace pattern.
        const merged = {
            '**/*.py': false,
            '**/test_*.py': true,
        };

        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(pyFile, merged), false);
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(testFile, merged), true);
    });

    test('workspace-relative globs match files inside the workspace', () => {
        const pattern = { 'tests/**/*.py': true };

        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern('/workspace/tests/test_foo.py', pattern), false);
        assert.strictEqual(
            matchesAutoTestDiscoverOnSavePattern('/workspace/tests/test_foo.py', pattern, '/workspace'),
            true,
        );
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern('/workspace/src/app.py', pattern, '/workspace'), false);
        assert.strictEqual(
            matchesAutoTestDiscoverOnSavePattern('/other/tests/test_foo.py', pattern, '/workspace'),
            false,
        );
    });

    test('windows paths and backslash globs match', () => {
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern('C:\\workspace\\pkg\\test_app.py', '**/*.py'), true);
        assert.strictEqual(
            matchesAutoTestDiscoverOnSavePattern(
                'C:\\workspace\\tests\\test_app.py',
                { 'tests/**/*.py': true },
                'C:\\workspace',
            ),
            true,
        );
        assert.strictEqual(
            matchesAutoTestDiscoverOnSavePattern('C:\\workspace\\pkg\\app.py', { '**\\*.py': true }),
            true,
        );
    });

    test('missing and invalid patterns do not match and do not throw', () => {
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(pyFile, undefined), false);
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(pyFile, null), false);
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(pyFile, {}), false);
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(pyFile, { '**/*.py': false }), false);
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(pyFile, ['**/*.py'] as any), false);
        assert.strictEqual(matchesAutoTestDiscoverOnSavePattern(pyFile, { '**/*.py': 'yes' } as any), false);
    });

    test('resolve substitutes variables in glob keys and keeps booleans', () => {
        const resolved = resolveAutoTestDiscoverOnSavePattern(
            {
                '${workspaceFolder}/**/test_*.py': true,
                '**/*.py': false,
                '  **/extra.py  ': true,
                ignored: 'nope' as any,
                '': true,
            },
            (value) => value.replace('${workspaceFolder}', '/repo'),
        );

        assert.deepStrictEqual(resolved, {
            '/repo/**/test_*.py': true,
            '**/*.py': false,
            '**/extra.py': true,
        });
    });

    test('resolve lets a later key win when two keys resolve to the same glob', () => {
        const resolved = resolveAutoTestDiscoverOnSavePattern(
            {
                '${root}/**/test_*.py': true,
                '/repo/**/test_*.py': false,
            },
            (value) => value.replace('${root}', '/repo'),
        );

        assert.deepStrictEqual(resolved, { '/repo/**/test_*.py': false });
    });

    test('resolve leaves a legacy string unchanged', () => {
        assert.strictEqual(
            resolveAutoTestDiscoverOnSavePattern('${workspaceFolder}/**/*.py', (value) => value),
            '${workspaceFolder}/**/*.py',
        );
        assert.strictEqual(
            resolveAutoTestDiscoverOnSavePattern(undefined, (value) => value),
            undefined,
        );
    });

    test('package.json default matches the built-in pattern', () => {
        const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../package.json'), 'utf8'));
        const contribution =
            packageJson.contributes.configuration.properties['python.testing.autoTestDiscoverOnSavePattern'];

        assert.deepStrictEqual(contribution.default, DEFAULT_AUTO_TEST_DISCOVER_ON_SAVE_PATTERN);
        assert.strictEqual(contribution.type, 'object');
        assert.strictEqual(contribution.additionalProperties.type, 'boolean');
        assert.strictEqual(contribution.scope, 'resource');
    });
});
