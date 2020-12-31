import { assert } from 'chai';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import { IWorkspaceService } from '../../client/common/application/types';
import { sleep } from '../../client/common/utils/async';
import { TensorBoardFileWatcher } from '../../client/tensorBoard/tensorBoardFileWatcher';
import { TensorBoardPrompt } from '../../client/tensorBoard/tensorBoardPrompt';
import { initialize } from '../initialize';

suite('TensorBoard file system watcher', async () => {
    const tfeventfileName = 'events.out.tfevents.1606887221.24672.162.v2';
    const currentDirectory = process.env.CODE_TESTS_WORKSPACE
        ? process.env.CODE_TESTS_WORKSPACE
        : path.join(__dirname, '..', '..', '..', 'src', 'test');
    let showNativeTensorBoardPrompt: sinon.SinonSpy;
    let eventFile: string | undefined;
    let eventFileDirectory: string | undefined;

    async function createFiles(directory: string) {
        eventFileDirectory = directory;
        await fse.ensureDir(directory);
        eventFile = path.join(directory, tfeventfileName);
        await fse.writeFile(eventFile, '');
    }

    async function testSetup() {
        const { serviceManager } = await initialize();
        // Stub the prompt show method so we can verify that it was called
        const prompt = serviceManager.get<TensorBoardPrompt>(TensorBoardPrompt);
        showNativeTensorBoardPrompt = sinon.stub(prompt, 'showNativeTensorBoardPrompt');
        serviceManager.rebindInstance(TensorBoardPrompt, prompt);
        const fileWatcher = serviceManager.get<TensorBoardFileWatcher>(TensorBoardFileWatcher);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (fileWatcher as any).activateInternal();
    }

    teardown(async () => {
        sinon.restore();
        if (eventFile) {
            await fse.unlink(eventFile);
            eventFile = undefined;
        }
        if (eventFileDirectory && eventFileDirectory !== currentDirectory) {
            await fse.rmdir(eventFileDirectory);
            eventFileDirectory = undefined;
        }
    });

    test('Preexisting tfeventfile in workspace root results in prompt being shown', async function () {
        await createFiles(currentDirectory);
        await testSetup();
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Preexisting tfeventfile one directory down results in prompt being shown', async function () {
        const dir1 = path.join(currentDirectory, '1');
        await createFiles(dir1);
        await testSetup();
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Preexisting tfeventfile two directories down does not result in prompt being called', async function () {
        const dir2 = path.join(currentDirectory, '1', '2');
        await createFiles(dir2);
        await testSetup();
        assert.ok(showNativeTensorBoardPrompt.notCalled);
    });

    test('Creating tfeventfile in workspace root results in prompt being shown', async function () {
        await testSetup();
        await createFiles(currentDirectory);
        await sleep(5000); // Wait for VSCode to fire onDidCreate
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Creating tfeventfile one directory down results in prompt being shown', async function () {
        const dir1 = path.join(currentDirectory, '1');
        await testSetup();
        await createFiles(dir1);
        await sleep(5000); // Wait for VSCode to fire onDidCreate
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Creating tfeventfile two directories down does not result in prompt being called', async function () {
        const dir2 = path.join(currentDirectory, '1', '2');
        await testSetup();
        await createFiles(dir2);
        assert.ok(showNativeTensorBoardPrompt.notCalled);
    });

    test('No workspace folder open, prompt is not called', async function () {
        const { serviceManager } = await initialize();

        // Stub the prompt show method so we can verify that it was called
        const prompt = serviceManager.get<TensorBoardPrompt>(TensorBoardPrompt);
        showNativeTensorBoardPrompt = sinon.stub(prompt, 'showNativeTensorBoardPrompt');
        serviceManager.rebindInstance(TensorBoardPrompt, prompt);

        // Pretend there are no open folders
        const workspaceService = serviceManager.get<IWorkspaceService>(IWorkspaceService);
        sinon.stub(workspaceService, 'workspaceFolders').get(() => undefined);
        serviceManager.rebindInstance(IWorkspaceService, workspaceService);
        const fileWatcher = serviceManager.get<TensorBoardFileWatcher>(TensorBoardFileWatcher);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (fileWatcher as any).activateInternal();

        assert.ok(showNativeTensorBoardPrompt.notCalled);
    });
});
