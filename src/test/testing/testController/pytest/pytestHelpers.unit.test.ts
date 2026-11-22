// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as assert from 'assert';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { handleSymlinkAndRootDir } from '../../../../client/testing/testController/pytest/pytestHelpers';
import * as utils from '../../../../client/testing/testController/common/utils';
import * as fsPaths from '../../../../client/common/platform/fs-paths';

suite('pytestHelpers handleSymlinkAndRootDir', () => {
    teardown(() => {
        sinon.restore();
    });

    test('does not check symlink parent when cwd and resolvedPath are considered the same path', async () => {
        sinon.stub(fs.promises, 'lstat').resolves({
            isSymbolicLink: () => false,
        } as fs.Stats);
        sinon.stub(fs.promises, 'realpath').resolves('C:\\clones\\python-soundfile');
        sinon.stub(fsPaths, 'arePathsSame').callsFake((p1, p2) => p1.toLowerCase() === p2.toLowerCase());

        const hasSymlinkParentStub = sinon.stub(utils, 'hasSymlinkParent');

        const result = await handleSymlinkAndRootDir('c:\\clones\\python-soundfile', ['arg1']);

        assert.strictEqual(hasSymlinkParentStub.called, false);
        assert.deepStrictEqual(result, ['arg1', '--rootdir=c:\\clones\\python-soundfile']);
    });

    test('checks symlink parent when resolvedPath differs from cwd', async () => {
        sinon.stub(fs.promises, 'lstat').resolves({
            isSymbolicLink: () => false,
        } as fs.Stats);
        sinon.stub(fs.promises, 'realpath').resolves('/real/path/to/project');
        sinon.stub(fsPaths, 'arePathsSame').returns(false);

        const hasSymlinkParentStub = sinon.stub(utils, 'hasSymlinkParent').resolves(true);

        const result = await handleSymlinkAndRootDir('/symlink/to/project', ['arg1']);

        assert.strictEqual(hasSymlinkParentStub.calledOnceWith('/symlink/to/project'), true);
        assert.deepStrictEqual(result, ['arg1', '--rootdir=/symlink/to/project']);
    });

    test('detects direct symlink without checking parent directories', async () => {
        sinon.stub(fs.promises, 'lstat').resolves({
            isSymbolicLink: () => true,
        } as fs.Stats);
        sinon.stub(fs.promises, 'realpath').resolves('/real/path');

        const hasSymlinkParentStub = sinon.stub(utils, 'hasSymlinkParent');

        const result = await handleSymlinkAndRootDir('/symlink/path', ['arg1']);

        assert.strictEqual(hasSymlinkParentStub.called, false);
        assert.deepStrictEqual(result, ['arg1', '--rootdir=/symlink/path']);
    });
});
