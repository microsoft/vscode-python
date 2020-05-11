// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { BaseReduxActionPayload } from '../../../client/datascience/interactive-common/types';
import { IStartPageMapping, StartPageMessages } from '../../../client/datascience/startPage/types';
import { ReducerArg, ReducerFunc } from '../../react-common/reduxUtils';
import { IStartPageProps } from '../startPage';

type StartPageReducerFunc<T = never | undefined> = ReducerFunc<
    IStartPageProps,
    StartPageMessages,
    BaseReduxActionPayload<T>
>;

export type StartPageReducerArg<T = never | undefined> = ReducerArg<
    IStartPageProps,
    StartPageMessages,
    BaseReduxActionPayload<T>
>;

type StartPageReducerFunctions<T> = {
    [P in keyof T]: T[P] extends never | undefined ? StartPageReducerFunc : StartPageReducerFunc<T[P]>;
};

export type IStartPageActionMapping = StartPageReducerFunctions<IStartPageMapping>;
