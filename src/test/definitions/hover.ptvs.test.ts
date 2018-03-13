// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { IS_PTVS_ENGINE_TEST } from '../constants';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { normalizeMarkedString } from '../textUtils';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const hoverPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'hover');
const fileOne = path.join(autoCompPath, 'one.py');
const fileThree = path.join(autoCompPath, 'three.py');
const fileEncoding = path.join(autoCompPath, 'four.py');
const fileEncodingUsed = path.join(autoCompPath, 'five.py');
const fileHover = path.join(autoCompPath, 'hoverTest.py');
const fileStringFormat = path.join(hoverPath, 'stringFormat.py');

let textDocument: vscode.TextDocument;

// tslint:disable-next-line:max-func-body-length
suite('Hover Definition (PTVS)', () => {
    suiteSetup(async function () {
        if (!IS_PTVS_ENGINE_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await initialize();
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    async function openAndHover(file: string, line: number, character: number): Promise<vscode.Hover[]> {
        textDocument = await vscode.workspace.openTextDocument(file);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(line, character);
        const result = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', textDocument.uri, position);
        return result ? result : [];
    }

    test('Method', async () => {
        const def = await openAndHover(fileOne, 30, 5);
        assert.equal(def.length, 1, 'Definition length is incorrect');

        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '30,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '30,11', 'End position is incorrect');
        assert.equal(def[0].contents.length, 1, 'Invalid content items');
        // tslint:disable-next-line:prefer-template
        const expectedContent = 'method method1 of one.Class1 objects ' + EOL + EOL + '```html ' + EOL + '        This is method1   ' + EOL + '```';
        assert.equal(normalizeMarkedString(def[0].contents[0]), expectedContent, 'function signature incorrect');
    });

    test('Across files', async () => {
        const def = await openAndHover(fileThree, 1, 12);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '1,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '1,12', 'End position is incorrect');
        // tslint:disable-next-line:prefer-template
        const expectedContent = 'method fun of two.ct objects ' + EOL + EOL + '```html ' + EOL + '        This is fun   ' + EOL + '```';
        assert.equal(normalizeMarkedString(def[0].contents[0]), expectedContent, 'Invalid conents');
    });

    test('With Unicode Characters', async () => {
        const def = await openAndHover(fileEncoding, 25, 6);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '25,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '25,7', 'End position is incorrect');
        // tslint:disable-next-line:prefer-template
        const expectedContent = 'def four.Foo.bar()' + EOL + EOL +
            '```html ' + EOL +
            '        说明 - keep this line, it works   ' + EOL +
            '        delete following line, it works   ' + EOL +
            '        如果存在需要等待审批或正在执行的任务，将不刷新页面   ' + EOL +
            '```';
        assert.equal(normalizeMarkedString(def[0].contents[0]), expectedContent, 'Invalid contents');
    });

    test('Across files with Unicode Characters', async () => {
        const def = await openAndHover(fileEncodingUsed, 1, 11);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '1,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '1,16', 'End position is incorrect');
        // tslint:disable-next-line:prefer-template
        const expectedContent = 'def four.showMessage()' + EOL + EOL +
            '```html ' + EOL +
            '    Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи.    ' + EOL +
            '    Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.   ' + EOL +
            '```';
        // tslint:disable-next-line:prefer-template
        assert.equal(normalizeMarkedString(def[0].contents[0]), expectedContent, 'Invalid contents');
    });

    test('Nothing for keywords (class)', async () => {
        const def = await openAndHover(fileOne, 5, 1);
        assert.equal(def.length, 0, 'Definition length is incorrect');
    });

    test('Nothing for keywords (for)', async () => {
        const def = await openAndHover(fileHover, 3, 1);
        assert.equal(def!.length, 0, 'Definition length is incorrect');
    });

    test('Highlighting Class', async () => {
        const def = await openAndHover(fileHover, 11, 15);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '11,7', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '11,18', 'End position is incorrect');
        // tslint:disable-next-line:prefer-template
        const documentation = 'Random' + EOL + EOL +
            'Random number generator base class used by bound module functions. ' + EOL +
            '```html ' + EOL +
            '    Used to instantiate instances of Random to get generators that don\'t   ' + EOL +
            '    share state.   ' + EOL +
            '   ' + EOL +
            '    Class Random can also be subclassed if you want to use a different basic   ' + EOL +
            '    generator of your own devising: in that case, override the following   ' + EOL +
            '    methods: random(), seed(), getstate(), and setstate().   ' + EOL +
            '    Optionally, implement a getrandbits() method so that randrange()   ' + EOL +
            '    can cover arbitrarily large ranges.   ' + EOL +
            '```';
        assert.equal(normalizeMarkedString(def[0].contents[0]), documentation, 'Invalid conents');
    });

    test('Highlight Method', async () => {
        const def = await openAndHover(fileHover, 12, 10);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '12,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '12,12', 'End position is incorrect');
        assert.equal(normalizeMarkedString(def[0].contents[0]),
            // tslint:disable-next-line:prefer-template
            'method randint of misc.Random objects  -> int' + EOL + EOL +
            'Return random integer in range [a, b], including both end points.', 'Invalid conents');
    });

    test('Highlight Function', async () => {
        const def = await openAndHover(fileHover, 8, 14);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '8,6', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '8,15', 'End position is incorrect');
        // tslint:disable-next-line:prefer-template
        assert.equal(normalizeMarkedString(def[0].contents[0]),
            // tslint:disable-next-line:prefer-template
            'built-in function acos(x)' + EOL + EOL +
            'acos(x) ' + EOL +
            ' ' + EOL +
            'Return the arc cosine (measured in radians) of x.', 'Invalid conents');
    });

    test('Highlight Multiline Method Signature', async () => {
        const def = await openAndHover(fileHover, 14, 14);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '14,4', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '14,15', 'End position is incorrect');
        // tslint:disable-next-line:prefer-template
        assert.equal(normalizeMarkedString(def[0].contents[0]),
            // tslint:disable-next-line:prefer-template
            'Thread' + EOL + EOL +
            'A class that represents a thread of control. ' + EOL +
            '```html ' + EOL +
            '    This class can be safely subclassed in a limited fashion.   ' + EOL +
            '```', 'Invalid content items');
    });

    test('Variable', async () => {
        const def = await openAndHover(fileHover, 6, 2);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(def[0].contents.length, 1, 'Only expected one result');
        const contents = normalizeMarkedString(def[0].contents[0]);
        if (contents.indexOf('Random') === -1) {
            assert.fail(contents, '', 'Variable type is missing', 'compare');
        }
    });

    test('format().capitalize()', async function () {
        // https://github.com/Microsoft/PTVS/issues/3868
        // tslint:disable-next-line:no-invalid-this
        this.skip();
        const def = await openAndHover(fileStringFormat, 5, 41);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(def[0].contents.length, 1, 'Only expected one result');
        const contents = normalizeMarkedString(def[0].contents[0]);
        if (contents.indexOf('capitalize') === -1) {
            assert.fail(contents, '', '\'capitalize\' is missing', 'compare');
        }
        if (contents.indexOf('Return a capitalized version of S') === -1 &&
            contents.indexOf('Return a copy of the string S with only its first character') === -1) {
            assert.fail(contents, '', '\'Return a capitalized version of S/Return a copy of the string S with only its first character\' message missing', 'compare');
        }
    });
});
