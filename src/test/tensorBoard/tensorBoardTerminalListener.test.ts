import { assert } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { sleep } from '../../client/common/utils/async';
import { TensorBoardPrompt } from '../../client/tensorBoard/tensorBoardPrompt';
import { initialize } from '../initialize';

const terminalWriteTimeout = 5000;

suite('TensorBoard terminal listener', async () => {
    let showNativeTensorBoardPrompt: sinon.SinonSpy;
    let terminal: vscode.Terminal;

    setup(async () => {
        const { serviceManager } = await initialize();
        const prompt = serviceManager.get<TensorBoardPrompt>(TensorBoardPrompt);
        showNativeTensorBoardPrompt = sinon.stub(prompt, 'showNativeTensorBoardPrompt');
        serviceManager.rebindInstance(TensorBoardPrompt, prompt);
        terminal = vscode.window.createTerminal('pty');
        terminal.show(false);
    });

    teardown(async () => {
        showNativeTensorBoardPrompt.restore();
        terminal.dispose();
    });

    test('Paste tensorboard launch command', async () => {
        // Simulate user pasting in a launch command all at once
        // or filling it in using terminal command history
        terminal.sendText('tensorboard --logdir logs/fit', true);
        await sleep(terminalWriteTimeout);
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Type in tensorboard launch command', async () => {
        // onDidWriteTerminalData fires with each character
        // that a user types into the terminal. Simulate this
        // by sending one character at a time
        for (const ch of 'tensorboard\n') {
            terminal.sendText(ch, false);
        }
        await sleep(terminalWriteTimeout);
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Multiline terminal write', async () => {
        terminal.sendText('foo\ntensorboard --logdir logs/fit\nbar', false);
        await sleep(terminalWriteTimeout);
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Prompt not shown if no matching command', async () => {
        terminal.sendText('tensorboar', true);
        await sleep(terminalWriteTimeout);
        assert.ok(showNativeTensorBoardPrompt.notCalled);
    });

    test('Backspaces are correctly handled', async () => {
        terminal.sendText('\b\b\b\b', false); // We should just ignore these
        await sleep(terminalWriteTimeout);
        assert.ok(showNativeTensorBoardPrompt.notCalled);
        terminal.sendText('tensor\b', false);
        await sleep(terminalWriteTimeout);
        assert.ok(showNativeTensorBoardPrompt.notCalled);
        terminal.sendText('rboard', true);
        await sleep(terminalWriteTimeout);
        assert.ok(showNativeTensorBoardPrompt.called);
    });
});
