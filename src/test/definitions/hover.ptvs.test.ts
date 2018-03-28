// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import '../../client/common/extensions';
import { IS_ANALYSIS_ENGINE_TEST } from '../constants';
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
suite('Hover Definition (Analysis Engine)', () => {
    suiteSetup(async function () {
        if (!IS_ANALYSIS_ENGINE_TEST) {
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

        const lines = normalizeMarkedString(def[0].contents[0]).splitLines();
        assert.equal(lines.length, 2, 'incorrect number of lines');
        assert.equal(lines[0].trim(), 'obj.method1: method method1 of one.Class1 objects', 'function signature line #1 is incorrect');
        assert.equal(lines[1].trim(), 'This is method1', 'function signature line #2 is incorrect');
    });

    test('Across files', async () => {
        const def = await openAndHover(fileThree, 1, 12);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '1,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '1,12', 'End position is incorrect');

        const lines = normalizeMarkedString(def[0].contents[0]).splitLines();
        assert.equal(lines.length, 2, 'incorrect number of lines');
        assert.equal(lines[0].trim(), 'two.ct().fun: method fun of two.ct objects', 'function signature line #1 is incorrect');
        assert.equal(lines[1].trim(), 'This is fun', 'function signature line #2 is incorrect');
    });

    test('With Unicode Characters', async () => {
        const def = await openAndHover(fileEncoding, 25, 6);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '25,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '25,7', 'End position is incorrect');

        const lines = normalizeMarkedString(def[0].contents[0]).splitLines();
        assert.equal(lines.length, 5, 'incorrect number of lines');
        assert.equal(lines[0].trim(), 'Foo.bar: def four.Foo.bar()', 'function signature line #1 is incorrect');
        assert.equal(lines[1].trim(), '说明 - keep this line, it works', 'function signature line #2 is incorrect');
        assert.equal(lines[2].trim(), 'delete following line, it works', 'function signature line #3 is incorrect');
        assert.equal(lines[3].trim(), '如果存在需要等待审批或正在执行的任务，将不刷新页面', 'function signature line #4 is incorrect');
        assert.equal(lines[4].trim(), 'declared in Foo', 'function signature line #5 is incorrect');
    });

    test('Across files with Unicode Characters', async () => {
        const def = await openAndHover(fileEncodingUsed, 1, 11);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '1,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '1,16', 'End position is incorrect');

        const lines = normalizeMarkedString(def[0].contents[0]).splitLines();
        assert.equal(lines.length, 3, 'incorrect number of lines');
        assert.equal(lines[0].trim(), 'four.showMessage: def four.showMessage()', 'function signature line #1 is incorrect');
        assert.equal(lines[1].trim(), 'Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи.', 'function signature line #2 is incorrect');
        assert.equal(lines[2].trim(), 'Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.', 'function signature line #3 is incorrect');
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

        const lines = normalizeMarkedString(def[0].contents[0]).splitLines();
        assert.equal(lines.length, 9, 'incorrect number of lines');
        assert.equal(lines[0].trim(), 'misc.Random: class misc.Random(_random.Random)', 'function signature line #1 is incorrect');
        assert.equal(lines[1].trim(), 'Random number generator base class used by bound module functions.', 'function signature line #2 is incorrect');
    });

    test('Highlight Method', async () => {
        const def = await openAndHover(fileHover, 12, 10);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '12,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '12,12', 'End position is incorrect');

        const lines = normalizeMarkedString(def[0].contents[0]).splitLines();
        assert.equal(lines.length, 2, 'incorrect number of lines');
        assert.equal(lines[0].trim(), 'rnd2.randint: method randint of misc.Random objects  -> int', 'function signature line #1 is incorrect');
        assert.equal(lines[1].trim(), 'Return random integer in range [a, b], including both end points.', 'function signature line #2 is incorrect');
    });

    test('Highlight Function', async () => {
        const def = await openAndHover(fileHover, 8, 14);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '8,6', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '8,15', 'End position is incorrect');

        const lines = normalizeMarkedString(def[0].contents[0]).splitLines();
        assert.equal(lines.length, 3, 'incorrect number of lines');
        assert.equal(lines[0].trim(), 'math.acos: built-in function acos(x)', 'function signature line #1 is incorrect');
        assert.equal(lines[1].trim(), 'acos(x)', 'function signature line #2 is incorrect');
        assert.equal(lines[2].trim(), 'Return the arc cosine (measured in radians) of x.', 'function signature line #3 is incorrect');
    });

    test('Highlight Multiline Method Signature', async () => {
        const def = await openAndHover(fileHover, 14, 14);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '14,4', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '14,15', 'End position is incorrect');

        const lines = normalizeMarkedString(def[0].contents[0]).splitLines();
        assert.equal(lines.length, 3, 'incorrect number of lines');
        assert.equal(lines[0].trim(), 'misc.Thread: class misc.Thread(_Verbose)', 'function signature line #1 is incorrect');
        assert.equal(lines[1].trim(), 'A class that represents a thread of control.', 'function signature line #2 is incorrect');

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
