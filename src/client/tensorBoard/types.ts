// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IInstaller } from '../common/types';
import { TensorBoardSession } from './tensorBoardSession';

export const ITensorBoardSessionProvider = Symbol('ITensorBoardSessionProvider');

export interface ITensorBoardSessionProvider {
    getOrCreate(installer: IInstaller): Promise<TensorBoardSession>;
}
