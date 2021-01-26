import { assert } from 'chai';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import { IWorkspaceService } from '../../client/common/application/types';
import { IExperimentService } from '../../client/common/types';
import { TensorBoardFileWatcher } from '../../client/tensorBoard/tensorBoardFileWatcher';
import { TensorBoardPrompt } from '../../client/tensorBoard/tensorBoardPrompt';
import { waitForCondition } from '../common';
import { initialize } from '../initialize';

suite('TensorBoard file system watcher', async () => {
    const tfeventfileName = 'events.out.tfevents.1606887221.24672.162.v2';
    const currentDirectory = process.env.CODE_TESTS_WORKSPACE ?? path.join(__dirname, '..', '..', '..', 'src', 'test');
    let showNativeTensorBoardPrompt: sinon.SinonSpy;
    const sandbox = sinon.createSandbox();
    let eventFile: string | undefined;
    let eventFileDirectory: string | undefined;

    async function createFiles(directory: string) {
        eventFileDirectory = directory;
        await fse.ensureDir(directory);
        eventFile = path.join(directory, tfeventfileName);
        await fse.writeFile(eventFile, '');
    }

    async function configureStubsAndActivate() {
        const { serviceManager } = await initialize();
        // Stub the prompt show method so we can verify that it was called
        const prompt = serviceManager.get<TensorBoardPrompt>(TensorBoardPrompt);
        showNativeTensorBoardPrompt = sandbox.stub(prompt, 'showNativeTensorBoardPrompt');
        serviceManager.rebindInstance(TensorBoardPrompt, prompt);
        const experimentService = serviceManager.get<IExperimentService>(IExperimentService);
        sandbox.stub(experimentService, 'inExperiment').resolves(true);
        const fileWatcher = serviceManager.get<TensorBoardFileWatcher>(TensorBoardFileWatcher);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (fileWatcher as any).activateInternal();
    }

    teardown(async () => {
        sandbox.restore();
        if (eventFile) {
            await fse.unlink(eventFile);
            eventFile = undefined;
        }
    });

    suiteTeardown(async () => {
        if (eventFileDirectory && eventFileDirectory !== currentDirectory) {
            await fse.rmdir(eventFileDirectory);
            eventFileDirectory = undefined;
        }
    });

    test('Preexisting tfeventfile in workspace root results in prompt being shown', async function () {
        await createFiles(currentDirectory);
        await configureStubsAndActivate();
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Preexisting tfeventfile one directory down results in prompt being shown', async function () {
        const dir1 = path.join(currentDirectory, '1');
        await createFiles(dir1);
        await configureStubsAndActivate();
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Preexisting tfeventfile two directories down results in prompt being called', async function () {
        const dir2 = path.join(currentDirectory, '1', '2');
        await createFiles(dir2);
        await configureStubsAndActivate();
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Preexisting tfeventfile three directories down does not result in prompt being called', async function () {
        const dir3 = path.join(currentDirectory, '1', '2', '3');
        await createFiles(dir3);
        await configureStubsAndActivate();
        assert.ok(showNativeTensorBoardPrompt.notCalled);
    });

    test('Creating tfeventfile in workspace root results in prompt being shown', async function () {
        await configureStubsAndActivate();
        await createFiles(currentDirectory);
        await waitForCondition(async () => showNativeTensorBoardPrompt.called, 5000, 'Prompt not shown');
    });

    test('Creating tfeventfile one directory down results in prompt being shown', async function () {
        const dir1 = path.join(currentDirectory, '1');
        await configureStubsAndActivate();
        await createFiles(dir1);
        await waitForCondition(async () => showNativeTensorBoardPrompt.called, 5000, 'Prompt not shown');
    });

    test('Creating tfeventfile two directories down results in prompt being called', async function () {
        const dir2 = path.join(currentDirectory, '1', '2');
        await configureStubsAndActivate();
        await createFiles(dir2);
        await waitForCondition(async () => showNativeTensorBoardPrompt.called, 5000, 'Prompt not shown');
    });

    test('Creating tfeventfile three directories down does not result in prompt being called', async function () {
        const dir3 = path.join(currentDirectory, '1', '2', '3');
        await configureStubsAndActivate();
        await createFiles(dir3);
        await waitForCondition(async () => showNativeTensorBoardPrompt.notCalled, 5000, 'Prompt shown');
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
