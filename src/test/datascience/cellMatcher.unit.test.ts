// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import { IDataScienceSettings } from '../../client/common/types';
import { CellMatcher } from '../../client/datascience/cellMatcher';
import { defaultDataScienceSettings } from './helpers';

suite('DataScience CellMatcher', () => {
    test('CellMatcher', () => {
        const settings: IDataScienceSettings = defaultDataScienceSettings();
        const matcher1 = new CellMatcher(settings);
        assert.ok(matcher1.isCode('# %%'), 'Base code is wrong');
        assert.ok(matcher1.isMarkdown('# %% [markdown]'), 'Base markdown is wrong');
        assert.equal(matcher1.exec('# %% TITLE'), 'TITLE', 'Title not found');

        settings.defaultCellMarker = '# %% CODE HERE';
        const matcher2 = new CellMatcher(settings);
        assert.ok(matcher2.isCode('# %%'), 'Code not found');
        assert.ok(matcher2.isCode('# %% CODE HERE'), 'Code not found');
        assert.ok(matcher2.isCode('# %% CODE HERE TOO'), 'Code not found');
        assert.ok(matcher2.isMarkdown('# %% [markdown]'), 'Base markdown is wrong');
        assert.equal(matcher2.exec('# %% CODE HERE'), '', 'Should not have a title');
        assert.equal(matcher2.exec('# %% CODE HERE FOO'), 'FOO', 'Should have a title');
    });
});
