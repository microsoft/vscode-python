// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import { closeActiveWindows, initialize, initializeTest } from '../../../initialize';
import { normalizeMarkedString } from '../../../textUtils';

const autoCompPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'autocomp');
const hoverPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'hover');
const fileOne = path.join(autoCompPath, 'one.py');
const fileThree = path.join(autoCompPath, 'three.py');
const fileEncoding = path.join(autoCompPath, 'four.py');
const fileEncodingUsed = path.join(autoCompPath, 'five.py');
const fileHover = path.join(autoCompPath, 'hoverTest.py');
const fileStringFormat = path.join(hoverPath, 'functionHover.py');

// tslint:disable-next-line:max-func-body-length
suite('Hover Definition (Jedi)', () => {
    suiteSetup(initialize);
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('Method', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileOne)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(30, 5);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(result => {
                const def = result!;
                assert.equal(def.length, 1, 'Definition length is incorrect');
                assert.equal(
                    `${def[0].range!.start.line},${def[0].range!.start.character}`,
                    '30,4',
                    'Start position is incorrect'
                );
                assert.equal(
                    `${def[0].range!.end.line},${def[0].range!.end.character}`,
                    '30,11',
                    'End position is incorrect'
                );
                assert.equal(def[0].contents.length, 1, 'Invalid content items');
                // tslint:disable-next-line:prefer-template
                const expectedContent = '```python' + EOL + 'def method1()' + EOL + '```' + EOL + 'This is method1';
                assert.equal(
                    normalizeMarkedString(def[0].contents[0]),
                    expectedContent,
                    'function signature incorrect'
                );
            })
            .then(done, done);
    });

    test('Across files', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileThree)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(1, 12);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(result => {
                const def = result!;
                assert.equal(def.length, 1, 'Definition length is incorrect');
                assert.equal(
                    `${def[0].range!.start.line},${def[0].range!.start.character}`,
                    '1,9',
                    'Start position is incorrect'
                );
                assert.equal(
                    `${def[0].range!.end.line},${def[0].range!.end.character}`,
                    '1,12',
                    'End position is incorrect'
                );
                assert.equal(
                    normalizeMarkedString(def[0].contents[0]),
                    // tslint:disable-next-line:prefer-template
                    '```python' + EOL + 'def fun()' + EOL + '```' + EOL + 'This is fun',
                    'Invalid contents'
                );
            })
            .then(done, done);
    });

    test('With Unicode Characters', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileEncoding)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(25, 6);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(result => {
                const def = result!;
                assert.equal(def.length, 1, 'Definition length is incorrect');
                assert.equal(
                    `${def[0].range!.start.line},${def[0].range!.start.character}`,
                    '25,4',
                    'Start position is incorrect'
                );
                assert.equal(
                    `${def[0].range!.end.line},${def[0].range!.end.character}`,
                    '25,7',
                    'End position is incorrect'
                );
                assert.equal(
                    normalizeMarkedString(def[0].contents[0]),
                    // tslint:disable-next-line:prefer-template
                    '```python' +
                        EOL +
                        'def bar()' +
                        EOL +
                        '```' +
                        EOL +
                        '说明 - keep this line, it works' +
                        EOL +
                        'delete following line, it works' +
                        EOL +
                        '如果存在需要等待审批或正在执行的任务，将不刷新页面',
                    'Invalid contents'
                );
            })
            .then(done, done);
    });

    test('Across files with Unicode Characters', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileEncodingUsed)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(1, 11);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(result => {
                const def = result!;
                assert.equal(def.length, 1, 'Definition length is incorrect');
                assert.equal(
                    `${def[0].range!.start.line},${def[0].range!.start.character}`,
                    '1,5',
                    'Start position is incorrect'
                );
                assert.equal(
                    `${def[0].range!.end.line},${def[0].range!.end.character}`,
                    '1,16',
                    'End position is incorrect'
                );
                assert.equal(
                    normalizeMarkedString(def[0].contents[0]),
                    // tslint:disable-next-line:prefer-template
                    '```python' +
                        EOL +
                        'def showMessage()' +
                        EOL +
                        '```' +
                        EOL +
                        'Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи. ' +
                        EOL +
                        'Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.',
                    'Invalid contents'
                );
            })
            .then(done, done);
    });

    test('Nothing for keywords (class)', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileOne)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(5, 1);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(def => {
                assert.equal(def!.length, 0, 'Definition length is incorrect');
            })
            .then(done, done);
    });

    test('Nothing for keywords (for)', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileHover)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(3, 1);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(def => {
                assert.equal(def!.length, 0, 'Definition length is incorrect');
            })
            .then(done, done);
    });

    test('Highlighting Class', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileHover)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(11, 15);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(result => {
                const def = result!;
                assert.equal(def.length, 1, 'Definition length is incorrect');
                assert.equal(
                    `${def[0].range!.start.line},${def[0].range!.start.character}`,
                    '11,12',
                    'Start position is incorrect'
                );
                assert.equal(
                    `${def[0].range!.end.line},${def[0].range!.end.character}`,
                    '11,18',
                    'End position is incorrect'
                );
                const documentation =
                    // tslint:disable-next-line:prefer-template
                    '```python' +
                    EOL +
                    'class Random(x=None)' +
                    EOL +
                    '```' +
                    EOL +
                    'Random number generator base class used by bound module functions.' +
                    EOL +
                    '' +
                    EOL +
                    "Used to instantiate instances of Random to get generators that don't" +
                    EOL +
                    'share state.' +
                    EOL +
                    '' +
                    EOL +
                    'Class Random can also be subclassed if you want to use a different basic' +
                    EOL +
                    'generator of your own devising: in that case, override the following' +
                    EOL +
                    'methods: random(), seed(), getstate(), and setstate().' +
                    EOL +
                    'Optionally, implement a getrandbits() method so that randrange()' +
                    EOL +
                    'can cover arbitrarily large ranges.';

                assert.equal(normalizeMarkedString(def[0].contents[0]), documentation, 'Invalid contents');
            })
            .then(done, done);
    });

    test('Highlight Method', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileHover)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(12, 10);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(result => {
                const def = result!;
                assert.equal(def.length, 1, 'Definition length is incorrect');
                assert.equal(
                    `${def[0].range!.start.line},${def[0].range!.start.character}`,
                    '12,5',
                    'Start position is incorrect'
                );
                assert.equal(
                    `${def[0].range!.end.line},${def[0].range!.end.character}`,
                    '12,12',
                    'End position is incorrect'
                );
                assert.equal(
                    normalizeMarkedString(def[0].contents[0]),
                    // tslint:disable-next-line:prefer-template
                    '```python' +
                        EOL +
                        'def randint(a, b)' +
                        EOL +
                        '```' +
                        EOL +
                        'Return random integer in range [a, b], including both end points.',
                    'Invalid contents'
                );
            })
            .then(done, done);
    });

    test('Highlight Function', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileHover)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(8, 14);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(result => {
                const def = result!;
                assert.equal(def.length, 1, 'Definition length is incorrect');
                assert.equal(
                    `${def[0].range!.start.line},${def[0].range!.start.character}`,
                    '8,11',
                    'Start position is incorrect'
                );
                assert.equal(
                    `${def[0].range!.end.line},${def[0].range!.end.character}`,
                    '8,15',
                    'End position is incorrect'
                );
                assert.equal(
                    normalizeMarkedString(def[0].contents[0]),
                    // tslint:disable-next-line:prefer-template
                    '```python' +
                        EOL +
                        'def acos(x: SupportsFloat)' +
                        EOL +
                        '```' +
                        EOL +
                        'Return the arc cosine (measured in radians) of x.',
                    'Invalid contents'
                );
            })
            .then(done, done);
    });

    test('Highlight Multiline Method Signature', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileHover)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(14, 14);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(result => {
                const def = result!;
                assert.equal(def.length, 1, 'Definition length is incorrect');
                assert.equal(
                    `${def[0].range!.start.line},${def[0].range!.start.character}`,
                    '14,9',
                    'Start position is incorrect'
                );
                assert.equal(
                    `${def[0].range!.end.line},${def[0].range!.end.character}`,
                    '14,15',
                    'End position is incorrect'
                );
                assert.equal(
                    normalizeMarkedString(def[0].contents[0]),
                    // tslint:disable-next-line:prefer-template
                    '```python' +
                        EOL +
                        'class Thread(group=None, target=None, name=None, args=(), kwargs=None, verbose=None)' +
                        EOL +
                        '```' +
                        EOL +
                        'A class that represents a thread of control.' +
                        EOL +
                        '' +
                        EOL +
                        'This class can be safely subclassed in a limited fashion.',
                    'Invalid content items'
                );
            })
            .then(done, done);
    });

    test('Variable', done => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileHover)
            .then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(_editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(6, 2);
                return vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    textDocument.uri,
                    position
                );
            })
            .then(result => {
                const def = result!;
                assert.equal(def.length, 1, 'Definition length is incorrect');
                assert.equal(def[0].contents.length, 1, 'Only expected one result');
                const contents = normalizeMarkedString(def[0].contents[0]);
                if (contents.indexOf('```python') === -1) {
                    assert.fail(contents, '', 'First line is incorrect', 'compare');
                }
                if (contents.indexOf('rnd: Random') === -1) {
                    assert.fail(contents, '', 'Variable name or type are missing', 'compare');
                }
            })
            .then(done, done);
    });

    test('Hover over method shows proper text.', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileStringFormat);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(8, 4);
        const def = (await vscode.commands.executeCommand<vscode.Hover[]>(
            'vscode.executeHoverProvider',
            textDocument.uri,
            position
        ))!;
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(def[0].contents.length, 1, 'Only expected one result');
        const contents = normalizeMarkedString(def[0].contents[0]);
        if (contents.indexOf('def my_func') === -1) {
            assert.fail(contents, '', "'def my_func' is missing", 'compare');
        }
        if (contents.indexOf('This is a test.') === -1 && contents.indexOf('It also includes this text, too.') === -1) {
            assert.fail(contents, '', 'Expected custom function text missing', 'compare');
        }
    });
});
