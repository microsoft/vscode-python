// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import { InputHistory } from '../../datascience-ui/interactive-common/inputHistory';

suite('Data Science InputHistory', () => {
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
});
