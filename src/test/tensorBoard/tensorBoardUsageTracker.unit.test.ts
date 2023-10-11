import { assert } from 'chai';
import * as sinon from 'sinon';
import { anything, reset, when } from 'ts-mockito';
import { TensorBoardUsageTracker } from '../../client/tensorBoard/tensorBoardUsageTracker';
import { TensorBoardPrompt } from '../../client/tensorBoard/tensorBoardPrompt';
import { MockDocumentManager } from '../mocks/mockDocumentManager';
import { createTensorBoardPromptWithMocks } from './helpers';
import { mockedVSCodeNamespaces } from '../vscode-mock';

suite('TensorBoard usage tracker', () => {
    let documentManager: MockDocumentManager;
    let tensorBoardImportTracker: TensorBoardUsageTracker;
    let prompt: TensorBoardPrompt;
    let showNativeTensorBoardPrompt: sinon.SinonSpy;

    suiteSetup(() => {
        reset(mockedVSCodeNamespaces.extensions);
        when(mockedVSCodeNamespaces.extensions?.getExtension(anything())).thenReturn(undefined);
    });
    suiteTeardown(() => reset(mockedVSCodeNamespaces.extensions));
    setup(() => {
        documentManager = new MockDocumentManager();
        prompt = createTensorBoardPromptWithMocks();
        showNativeTensorBoardPrompt = sinon.spy(prompt, 'showNativeTensorBoardPrompt');
        tensorBoardImportTracker = new TensorBoardUsageTracker(documentManager, [], prompt);
    });

    test('Simple tensorboard import in Python file', async () => {
        const document = documentManager.addDocument('import tensorboard', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        assert.ok(showNativeTensorBoardPrompt.calledOnce);
    });
    test('Simple tensorboardX import in Python file', async () => {
        const document = documentManager.addDocument('import tensorboardX', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        assert.ok(showNativeTensorBoardPrompt.calledOnce);
    });
    test('Simple tensorboard import in Python ipynb', async () => {
        const document = documentManager.addDocument('import tensorboard', 'foo.ipynb');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        assert.ok(showNativeTensorBoardPrompt.calledOnce);
    });
    test('`from x.y.tensorboard import z` import', async () => {
        const document = documentManager.addDocument('from torch.utils.tensorboard import SummaryWriter', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        assert.ok(showNativeTensorBoardPrompt.calledOnce);
    });
    test('`from x.y import tensorboard` import', async () => {
        const document = documentManager.addDocument('from torch.utils import tensorboard', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        assert.ok(showNativeTensorBoardPrompt.calledOnce);
    });
    test('`from tensorboardX import x` import', async () => {
        const document = documentManager.addDocument('from tensorboardX import SummaryWriter', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        assert.ok(showNativeTensorBoardPrompt.calledOnce);
    });
    test('`import x, y` import', async () => {
        const document = documentManager.addDocument('import tensorboard, tensorflow', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        assert.ok(showNativeTensorBoardPrompt.calledOnce);
    });
    test('`import pkg as _` import', async () => {
        const document = documentManager.addDocument('import tensorboard as tb', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        assert.ok(showNativeTensorBoardPrompt.calledOnce);
    });
    test('Show prompt on changed text editor', async () => {
        await tensorBoardImportTracker.activate();
        const document = documentManager.addDocument('import tensorboard as tb', 'foo.py');
        await documentManager.showTextDocument(document);
        assert.ok(showNativeTensorBoardPrompt.calledOnce);
    });
    test('Do not show prompt if no tensorboard import', async () => {
        const document = documentManager.addDocument('import tensorflow as tf\nfrom torch.utils import foo', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        assert.ok(showNativeTensorBoardPrompt.notCalled);
    });
    test('Do not show prompt if language is not Python', async () => {
        const document = documentManager.addDocument(
            'import tensorflow as tf\nfrom torch.utils import foo',
            'foo.cpp',
            'cpp',
        );
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        assert.ok(showNativeTensorBoardPrompt.notCalled);
    });
});
