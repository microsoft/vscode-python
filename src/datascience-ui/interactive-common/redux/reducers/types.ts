// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { ReducerArg } from '../../../react-common/reduxUtils';
import { IMainState } from '../../mainState';

export type CommonReducerArg<AT, T = never | undefined> = ReducerArg<IMainState, AT, T>;

export interface ICellAction {
    cellId: string | undefined;
}

export interface IEditCellAction extends ICellAction {
    changes: monacoEditor.editor.IModelContentChange[];
}

export interface ICodeAction extends ICellAction {
    code: string;
}
