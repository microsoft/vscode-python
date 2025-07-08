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
        if (process.platform === 'win32') {
            return;
        }
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

suite('clearTestItemsForWorkspace tests', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('should clear test items for specific workspace', () => {
        const { clearTestItemsForWorkspace } = require('../../../client/testing/testController/common/utils');
        
        // Mock test controller
        const mockTestController = {
            items: new Map(),
        };
        
        // Mock test items
        const workspaceUri1 = { fsPath: '/workspace1' };
        
        const testItem1 = { id: 'test1', uri: { fsPath: '/workspace1/test1.py' } };
        const testItem2 = { id: 'test2', uri: { fsPath: '/workspace1/test2.py' } };
        const testItem3 = { id: 'test3', uri: { fsPath: '/workspace2/test3.py' } };
        const testItem4 = { id: 'test4', uri: { fsPath: '/workspace2/test4.py' } };
        
        // Set up items
        mockTestController.items.set('test1', testItem1);
        mockTestController.items.set('test2', testItem2);
        mockTestController.items.set('test3', testItem3);
        mockTestController.items.set('test4', testItem4);
        
        // Mock forEach and delete methods
        const forEachSpy = sandbox.spy(mockTestController.items, 'forEach');
        const deleteSpy = sandbox.spy(mockTestController.items, 'delete');
        
        // Call the function to clear workspace1 items
        clearTestItemsForWorkspace(mockTestController as any, workspaceUri1 as any);
        
        // Verify forEach was called
        assert.ok(forEachSpy.called);
        
        // Verify that items from workspace1 were deleted
        assert.ok(deleteSpy.calledWith('test1'));
        assert.ok(deleteSpy.calledWith('test2'));
        
        // Verify that items from workspace2 were NOT deleted
        assert.ok(!deleteSpy.calledWith('test3'));
        assert.ok(!deleteSpy.calledWith('test4'));
    });
    
    test('should handle test items without uri', () => {
        const { clearTestItemsForWorkspace } = require('../../../client/testing/testController/common/utils');
        
        // Mock test controller
        const mockTestController = {
            items: new Map(),
        };
        
        const workspaceUri = { fsPath: '/workspace1' };
        
        // Mock test item without uri
        const testItemWithoutUri = { id: 'test1', uri: undefined };
        const testItemWithUri = { id: 'test2', uri: { fsPath: '/workspace1/test2.py' } };
        
        mockTestController.items.set('test1', testItemWithoutUri);
        mockTestController.items.set('test2', testItemWithUri);
        
        const deleteSpy = sandbox.spy(mockTestController.items, 'delete');
        
        // Should not throw error and should only delete items with matching uri
        clearTestItemsForWorkspace(mockTestController as any, workspaceUri as any);
        
        // Verify only the item with matching uri was deleted
        assert.ok(!deleteSpy.calledWith('test1'));
        assert.ok(deleteSpy.calledWith('test2'));
    });
});
