// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import { IDataScienceSettings } from '../../client/common/types';
import {
    createEmptyCell,
    CursorPos,
    extractInputText,
    ICellViewModel,
} from '../../datascience-ui/interactive-common/mainState';
import { defaultDataScienceSettings } from './helpers';

// tslint:disable: max-func-body-length
suite('Data Science MainState', () => {
    function cloneVM(cvm: ICellViewModel, newCode: string, debugging?: boolean): ICellViewModel {
        const result = {
            ...cvm,
            cell: {
                ...cvm.cell,
                data: {
                    ...cvm.cell.data,
                    source: newCode,
                },
            },
            inputBlockText: newCode,
            runDuringDebug: debugging,
        };

        // Typecast so that the build works. ICell.MetaData doesn't like reassigning
        // tslint:disable-next-line: no-any
        return (result as any) as ICellViewModel;
    }

    test('ExtractInputText', () => {
        const settings: IDataScienceSettings = defaultDataScienceSettings();
        settings.stopOnFirstLineWhileDebugging = true;
        const cvm: ICellViewModel = {
            cell: createEmptyCell('1', null),
            inputBlockCollapseNeeded: false,
            inputBlockText: '',
            inputBlockOpen: false,
            inputBlockShow: false,
            editable: false,
            focused: false,
            selected: false,
            scrollCount: 0,
            cursorPos: CursorPos.Current,
            hasBeenRun: false,
        };
        assert.equal(extractInputText(cloneVM(cvm, '# %%\na=1'), settings), 'a=1', 'Cell marker not removed');
        assert.equal(
            extractInputText(cloneVM(cvm, '# %%\nbreakpoint()\na=1'), settings),
            'breakpoint()\na=1',
            'Cell marker not removed'
        );
        assert.equal(
            extractInputText(cloneVM(cvm, '# %%\nbreakpoint()\na=1', true), settings),
            'a=1',
            'Cell marker not removed'
        );
    });
});
