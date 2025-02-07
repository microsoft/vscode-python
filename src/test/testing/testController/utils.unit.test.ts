import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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

        const result = await writeTestIdsFile(testIds);

        const tmpDir = os.tmpdir();

        assert.ok(result.startsWith(tmpDir));

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
