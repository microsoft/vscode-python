// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';

import { generateCells } from '../../client/datascience/cellFactory';
import { formatStreamText } from '../../client/datascience/common';
import { InputHistory } from '../../datascience-ui/history-react/inputHistory';

suite('Data Science Tests', () => {

    test('formatting stream text', async () => {
        assert.equal(formatStreamText('\rExecute\rExecute 1'), 'Execute 1');
        assert.equal(formatStreamText('\rExecute\r\nExecute 2'), 'Execute\nExecute 2');
        assert.equal(formatStreamText('\rExecute\rExecute\r\nExecute 3'), 'Execute\nExecute 3');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 4'), 'Execute\nExecute 4');
        assert.equal(formatStreamText('\rExecute\r\r \r\rExecute\nExecute 5'), 'Execute\nExecute 5');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 6\rExecute 7'), 'Execute\nExecute 7');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 8\rExecute 9\r\r'), 'Execute\n');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 10\rExecute 11\r\n'), 'Execute\nExecute 11\n');
    });

    test('input history', async () => {
        let history = new InputHistory();
        history.add('1', true);
        history.add('2', true);
        history.add('3', true);
        history.add('4', true);
        assert.equal(history.completeDown('5'), '5');
        history.add('5', true);
        assert.equal(history.completeUp(''), '5');
        history.add('5', false);
        assert.equal(history.completeUp('5'), '5');
        assert.equal(history.completeUp('4'), '4');
        assert.equal(history.completeUp('2'), '3');
        assert.equal(history.completeUp('1'), '2');
        assert.equal(history.completeUp(''), '1');

        // Add should reset position.
        history.add('6', true);
        assert.equal(history.completeUp(''), '6');
        assert.equal(history.completeUp(''), '5');
        assert.equal(history.completeUp(''), '4');
        assert.equal(history.completeUp(''), '3');
        assert.equal(history.completeUp(''), '2');
        assert.equal(history.completeUp(''), '1');
        history = new InputHistory();
        history.add('1', true);
        history.add('2', true);
        history.add('3', true);
        history.add('4', true);
        assert.equal(history.completeDown('5'), '5');
        assert.equal(history.completeDown(''), '');
        assert.equal(history.completeUp('1'), '4');
        assert.equal(history.completeDown('4'), '4');
        assert.equal(history.completeDown('4'), '4');
        assert.equal(history.completeUp('1'), '3');
        assert.equal(history.completeUp('4'), '2');
        assert.equal(history.completeDown('3'), '3');
        assert.equal(history.completeDown(''), '4');
        assert.equal(history.completeUp(''), '3');
        assert.equal(history.completeUp(''), '2');
        assert.equal(history.completeUp(''), '1');
        assert.equal(history.completeUp(''), '');
        assert.equal(history.completeUp('1'), '1');
        assert.equal(history.completeDown('1'), '2');
        assert.equal(history.completeDown('2'), '3');
        assert.equal(history.completeDown('3'), '4');
        assert.equal(history.completeDown(''), '');
        history.add('5', true);
        assert.equal(history.completeUp('1'), '5');
        assert.equal(history.completeUp('1'), '4');
        assert.equal(history.completeUp('1'), '3');
        history.add('3', false);
        assert.equal(history.completeUp('1'), '3');
        assert.equal(history.completeUp('1'), '2');
        assert.equal(history.completeUp('1'), '1');
        assert.equal(history.completeDown('1'), '2');
        assert.equal(history.completeUp('1'), '1');
        assert.equal(history.completeDown('1'), '2');
        assert.equal(history.completeDown('1'), '3');
        assert.equal(history.completeDown('1'), '4');
        assert.equal(history.completeDown('1'), '5');
        assert.equal(history.completeDown('1'), '3');
    });

    test('parsing cells', () => {
        let cells = generateCells(undefined, '#%%\na=1\na', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Simple cell, not right number found');
        cells = generateCells(undefined, '#%% [markdown]\na=1\na', 'foo', 0, true, '1');
        assert.equal(cells.length, 2, 'Split cell, not right number found');
        cells = generateCells(undefined, '#%% [markdown]\n# #a=1\n#a', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown split wrong');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        cells = generateCells(undefined, '#%% [markdown]\n\'\'\'\n# a\nb\n\'\'\'', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        assert.equal(cells[0].data.source.length, 2, 'Lines for markdown not emitted');
        cells = generateCells(undefined, '#%% [markdown]\n\"\"\"\n# a\nb\n\'\'\'', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        assert.equal(cells[0].data.source.length, 2, 'Lines for markdown not emitted');
        cells = generateCells(undefined, '#%% \n\"\"\"\n# a\nb\n\'\'\'', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Code cell multline failed');
        assert.equal(cells[0].data.cell_type, 'code', 'Code cell not generated');
        assert.equal(cells[0].data.source.length, 5, 'Lines for cell not emitted');
    });

});
