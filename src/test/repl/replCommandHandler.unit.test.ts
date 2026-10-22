// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { TabGroup, ViewColumn } from 'vscode';
import { getNewReplViewColumn } from '../../client/repl/replCommandHandler';

suite('REPL - command handler', () => {
    test('opens a new REPL in the active group when no tabs are open', () => {
        const emptyTabGroup = ({ tabs: [] } as unknown) as TabGroup;

        expect(getNewReplViewColumn([emptyTabGroup])).to.equal(ViewColumn.Active);
    });

    test('opens a new REPL beside existing tabs', () => {
        const emptyTabGroup = ({ tabs: [] } as unknown) as TabGroup;
        const tabGroupWithOpenTab = ({ tabs: [{}] } as unknown) as TabGroup;

        expect(getNewReplViewColumn([emptyTabGroup, tabGroupWithOpenTab])).to.equal(ViewColumn.Beside);
    });
});
