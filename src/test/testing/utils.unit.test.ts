// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { TestItem, env } from 'vscode';
import * as utils from '../../client/testing/utils';
import { PROJECT_ID_SEPARATOR } from '../../client/testing/testController/common/projectUtils';

use(chaiAsPromised.default);

suite('Testing - utils', () => {
    suite('idToModuleClassMethod', () => {
        test('single part is returned as is', () => {
            expect(utils.idToModuleClassMethod('foo')).to.equal('foo');
        });

        test('file and class are converted to module.class', () => {
            expect(utils.idToModuleClassMethod('a/b/c.py\\MyClass')).to.equal('c.MyClass');
        });

        test('file, class and method are converted to module.class.method', () => {
            expect(utils.idToModuleClassMethod('a/b/c.py\\MyClass\\my_method')).to.equal('c.MyClass.my_method');
        });

        test('missing file name results in undefined', () => {
            expect(utils.idToModuleClassMethod('\\MyClass')).to.be.undefined;
        });
    });

    suite('writeTestIdToClipboard', () => {
        async function copiedText(id: string): Promise<string> {
            await utils.writeTestIdToClipboard(({ id } as unknown) as TestItem);
            return env.clipboard.readText();
        }

        setup(async () => {
            await env.clipboard.writeText('');
        });

        test('legacy pytest id is copied as is', async () => {
            expect(await copiedText('tests/test_foo.py::TestClass::test_method')).to.equal(
                'tests/test_foo.py::TestClass::test_method',
            );
        });

        test('project scoped pytest id drops the project prefix', async () => {
            const id = `file:///path/to/workspace${PROJECT_ID_SEPARATOR}/path/to/workspace/tests/unit/test_foo.py::test_bar`;

            expect(await copiedText(id)).to.equal('/path/to/workspace/tests/unit/test_foo.py::test_bar');
        });

        test('project scoped parameterized pytest id keeps the parameters', async () => {
            const id = `file:///path/to/workspace${PROJECT_ID_SEPARATOR}tests/unit/test_foo.py::test_pipe_single[False]`;

            expect(await copiedText(id)).to.equal('tests/unit/test_foo.py::test_pipe_single[False]');
        });

        test('project scoped windows pytest id drops the project prefix', async () => {
            const id = `file:///c%3A/workspace${PROJECT_ID_SEPARATOR}c:\\workspace\\tests\\test_foo.py::test_bar`;

            expect(await copiedText(id)).to.equal('c:\\workspace\\tests\\test_foo.py::test_bar');
        });

        test('legacy unittest id is converted to module.class.method', async () => {
            expect(await copiedText('a/b/c.py\\MyClass\\my_method')).to.equal('c.MyClass.my_method');
        });

        test('project scoped unittest id is converted to module.class.method', async () => {
            const id = `file:///path/to/workspace${PROJECT_ID_SEPARATOR}a/b/c.py\\MyClass\\my_method`;

            expect(await copiedText(id)).to.equal('c.MyClass.my_method');
        });

        test('nothing is copied when there is no test item', async () => {
            await utils.writeTestIdToClipboard((undefined as unknown) as TestItem);

            expect(await env.clipboard.readText()).to.equal('');
        });
    });
});
