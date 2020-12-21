import * as sinon from 'sinon';
import { TensorBoardImportTracker } from '../../client/tensorBoard/tensorBoardImportTracker';
import { MockDocumentManager } from '../startPage/mockDocumentManager';

suite('TensorBoard import tracker', () => {
    let documentManager: MockDocumentManager;
    let tensorBoardImportTracker: TensorBoardImportTracker;
    let onDidImportTensorBoardListener: sinon.SinonExpectation;

    setup(() => {
        documentManager = new MockDocumentManager();
        tensorBoardImportTracker = new TensorBoardImportTracker(documentManager, []);
        onDidImportTensorBoardListener = sinon.expectation.create('onDidImportTensorBoardListener');
        tensorBoardImportTracker.onDidImportTensorBoard(onDidImportTensorBoardListener);
    });

    test('Simple tensorboard import in Python file', async () => {
        const document = documentManager.addDocument('import tensorboard', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        onDidImportTensorBoardListener.once().verify();
    });
    test('Simple tensorboard import in Python ipynb', async () => {
        const document = documentManager.addDocument('import tensorboard', 'foo.ipynb');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        onDidImportTensorBoardListener.once().verify();
    });
    test('`from x.y.tensorboard import z` import', async () => {
        const document = documentManager.addDocument('from torch.utils.tensorboard import SummaryWriter', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        onDidImportTensorBoardListener.once().verify();
    });
    test('`from x.y import tensorboard` import', async () => {
        const document = documentManager.addDocument('from torch.utils import tensorboard', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        onDidImportTensorBoardListener.once().verify();
    });
    test('`import x, y` import', async () => {
        const document = documentManager.addDocument('import tensorboard, tensorflow', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        onDidImportTensorBoardListener.once().verify();
    });
    test('`import pkg as _` import', async () => {
        const document = documentManager.addDocument('import tensorboard as tb', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        onDidImportTensorBoardListener.once().verify();
    });
    test('Fire on changed text editor', async () => {
        await tensorBoardImportTracker.activate();
        const document = documentManager.addDocument('import tensorboard as tb', 'foo.py');
        await documentManager.showTextDocument(document);
        onDidImportTensorBoardListener.once().verify();
    });
    test('Do not fire event if no tensorboard import', async () => {
        const document = documentManager.addDocument('import tensorflow as tf\nfrom torch.utils import foo', 'foo.py');
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        onDidImportTensorBoardListener.never().verify();
    });
    test('Do not fire event if language is not Python', async () => {
        const document = documentManager.addDocument(
            'import tensorflow as tf\nfrom torch.utils import foo',
            'foo.cpp',
            'cpp',
        );
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        onDidImportTensorBoardListener.never().verify();
    });
    test('Ignore docstrings', async () => {
        const document = documentManager.addDocument(
            `"""
import tensorboard
"""`,
            'foo.py',
        );
        await documentManager.showTextDocument(document);
        await tensorBoardImportTracker.activate();
        onDidImportTensorBoardListener.never().verify();
    });
});
