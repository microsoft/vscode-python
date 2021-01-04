import { assert } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { IExtensionSingleActivationService } from '../../client/activation/types';
import { sleep } from '../../client/common/utils/async';
import { TensorBoardPrompt } from '../../client/tensorBoard/tensorBoardPrompt';
import { TensorBoardTerminalListener } from '../../client/tensorBoard/tensorBoardTerminalListener';
import { isWindows } from '../core';
import { initialize } from '../initialize';

const terminalWriteTimeout = 5000;

suite('TensorBoard terminal listener', async () => {
    let showNativeTensorBoardPrompt: sinon.SinonSpy;
    let terminal: vscode.Terminal;

    setup(async () => {
        const { serviceManager } = await initialize();
        // Stub the prompt show method so we can verify that it was called
        const prompt = serviceManager.get<TensorBoardPrompt>(TensorBoardPrompt);
        showNativeTensorBoardPrompt = sinon.stub(prompt, 'showNativeTensorBoardPrompt');
        serviceManager.rebindInstance(TensorBoardPrompt, prompt);
        const terminalListener = serviceManager.get<IExtensionSingleActivationService>(TensorBoardTerminalListener);
        // Wait for activation so that we register our handler for onDidWriteTerminalData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (terminalListener as any).activateInternal();
        // Create the terminal and sleep for a bit since the terminal sometimes takes a while to show up
        terminal = vscode.window.createTerminal('pty');
        terminal.show(false);
        await sleep(terminalWriteTimeout);
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

    test('Backspaces are correctly handled', async function () {
        terminal.sendText('tensor', false);
        await sleep(terminalWriteTimeout);
        terminal.sendText('\b', false);
        await sleep(terminalWriteTimeout);
        terminal.sendText('rboard', true);
        await sleep(terminalWriteTimeout);
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Cursor position is correctly updated', async function () {
        // On Linux moving the cursor doesn't fire a terminal write data event
        // so we have no way to know that the cursor moved...
        if (!isWindows) {
            this.skip();
        }
        terminal.sendText('tensor', false);
        await sleep(terminalWriteTimeout);
        terminal.sendText('\x1b[D', false); // Move cursor one cell to the left
        await sleep(terminalWriteTimeout);
        terminal.sendText('\x1b[C', false); // Move cursor one cell to the right
        await sleep(terminalWriteTimeout);
        terminal.sendText('board', true);
        await sleep(terminalWriteTimeout);
        assert.ok(showNativeTensorBoardPrompt.called);
    });

    test('Insert into middle of current line', async function () {
        // On Linux moving the cursor doesn't fire a terminal write data event
        // so we have no way to know that the cursor moved...
        if (!isWindows) {
            this.skip();
        }
        terminal.sendText('tensor', false);
        await sleep(terminalWriteTimeout);
        terminal.sendText('\x1b[D', false); // Move cursor one cell to the left
        await sleep(terminalWriteTimeout);
        terminal.sendText('board', true);
        await sleep(terminalWriteTimeout);
        // Buffer now contains 'tensoboardr'
        assert.ok(showNativeTensorBoardPrompt.notCalled);
    });

    test('Insert into middle of current line inverse', async function () {
        // On Linux moving the cursor doesn't fire a terminal write data event
        // so we have no way to know that the cursor moved...
        if (!isWindows) {
            this.skip();
        }
        terminal.sendText('tensor ', false);
        await sleep(terminalWriteTimeout);
        terminal.sendText('\x1b[D', false); // Move cursor one cell to the left
        await sleep(terminalWriteTimeout);
        terminal.sendText('board', true);
        await sleep(terminalWriteTimeout);
        // Buffer now contains 'tensorboard ' (trailing whitespace)
        assert.ok(showNativeTensorBoardPrompt.called);
    });
});
