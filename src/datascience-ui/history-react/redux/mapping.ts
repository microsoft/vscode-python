// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages, IRefreshVariablesRequest } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages, IGetCssResponse } from '../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../client/datascience/monacoMessages';
import { ICell, IJupyterVariable, IJupyterVariablesResponse } from '../../../client/datascience/types';
import { IMainState } from '../../interactive-common/mainState';
import { ReducerArg, ReducerFunc } from '../../react-common/reduxUtils';
import {
    ICellAction,
    InteractiveActionTypes,
    IOpenLinkAction,
    IShowDataViewerAction,
    IShowPlotAction
} from './actions';

type InteractiveReducerFunc<T> = ReducerFunc<IMainState, InteractiveActionTypes, T>;

export type InteractiveReducerArg<T = never | undefined> = ReducerArg<IMainState, InteractiveActionTypes, T>;

export class IInteractiveActionMapping {
    public [InteractiveActionTypes.TOGGLE_VARIABLE_EXPLORER]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.REFRESH_VARIABLES]: InteractiveReducerFunc<IRefreshVariablesRequest>;
    public [InteractiveActionTypes.RESTART_KERNEL]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.INTERRUPT_KERNEL]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.EXPORT]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.SAVE]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.UNDO]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.SHOW_DATA_VIEWER]: InteractiveReducerFunc<IShowDataViewerAction>;
    public [InteractiveActionTypes.DELETE_CELL]: InteractiveReducerFunc<ICellAction>;
    public [InteractiveActionTypes.OPEN_LINK]: InteractiveReducerFunc<IOpenLinkAction>;
    public [InteractiveActionTypes.SHOW_PLOT]: InteractiveReducerFunc<IShowPlotAction>;

    // Messages from the extension
    public [InteractiveWindowMessages.StartCell]: InteractiveReducerFunc<ICell>;
    public [InteractiveWindowMessages.FinishCell]: InteractiveReducerFunc<ICell>;
    public [InteractiveWindowMessages.UpdateCell]: InteractiveReducerFunc<ICell>;
    public [InteractiveWindowMessages.Activate]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.GetVariablesResponse]: InteractiveReducerFunc<IJupyterVariablesResponse>;
    public [InteractiveWindowMessages.GetVariableValueResponse]: InteractiveReducerFunc<IJupyterVariable>;
    public [InteractiveWindowMessages.RestartKernel]: InteractiveReducerFunc<never | undefined>;
    public [CssMessages.GetCssResponse]: InteractiveReducerFunc<IGetCssResponse>;
    public [InteractiveWindowMessages.MonacoReady]: InteractiveReducerFunc<never | undefined>;
    public [CssMessages.GetMonacoThemeResponse]: InteractiveReducerFunc<IGetMonacoThemeResponse>;
}
