// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ReducerArg } from '../../../react-common/reduxUtils';
import { IMainState } from '../../mainState';

export type CommonReducerArg<AT, T = never | undefined> = ReducerArg<IMainState, AT, T>;
