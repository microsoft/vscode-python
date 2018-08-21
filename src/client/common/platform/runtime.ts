// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { getRandomBetween } from '../utils';
import { IRuntime } from './types';

export class Runtime implements IRuntime {

    public getRandomInt(min: number = 0, max: number = 10): number {
        return getRandomBetween(min, max);
    }
}
