import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { writeTestIdsFile } from '../../../client/testing/testController/common/utils';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';

suite('writeTestIdsFile tests', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('should write test IDs to a temporary file', async () => {
        const testIds = ['test1', 'test2', 'test3'];
        const writeFileStub = sandbox.stub(fs.promises, 'writeFile').resolves();

        // Set up XDG_RUNTIME_DIR
        process.env = {
            ...process.env,
            XDG_RUNTIME_DIR: '/xdg/runtime/dir',
        };

        await writeTestIdsFile(testIds);

        assert.ok(writeFileStub.calledOnceWith(sinon.match.string, testIds.join('\n')));
    });

    test('should handle error when accessing temp directory', async () => {
        const testIds = ['test1', 'test2', 'test3'];
        const error = new Error('Access error');
        const accessStub = sandbox.stub(fs.promises, 'access').rejects(error);
        const writeFileStub = sandbox.stub(fs.promises, 'writeFile').resolves();
        const mkdirStub = sandbox.stub(fs.promises, 'mkdir').resolves();

        const result = await writeTestIdsFile(testIds);

        const tempFileFolder = path.join(EXTENSION_ROOT_DIR, '.temp');

        assert.ok(result.startsWith(tempFileFolder));

        assert.ok(accessStub.called);
        assert.ok(mkdirStub.called);
        assert.ok(writeFileStub.calledOnceWith(sinon.match.string, testIds.join('\n')));
    });
});

suite('getTempDir tests', () => {
    let sandbox: sinon.SinonSandbox;
    let originalPlatform: NodeJS.Platform;
    let originalEnv: NodeJS.ProcessEnv;

    setup(() => {
        sandbox = sinon.createSandbox();
        originalPlatform = process.platform;
        originalEnv = process.env;
    });

    teardown(() => {
        sandbox.restore();
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        process.env = originalEnv;
    });

    test('should use XDG_RUNTIME_DIR on non-Windows if available', async () => {
        // Force platform to be Linux
        Object.defineProperty(process, 'platform', { value: 'linux' });

        // Set up XDG_RUNTIME_DIR
        process.env = { ...process.env, XDG_RUNTIME_DIR: '/xdg/runtime/dir' };

        const testIds = ['test1', 'test2', 'test3'];
        sandbox.stub(fs.promises, 'access').resolves();
        sandbox.stub(fs.promises, 'writeFile').resolves();

        // This will use getTempDir internally
        const result = await writeTestIdsFile(testIds);

        assert.ok(result.startsWith('/xdg/runtime/dir'));
    });
});
