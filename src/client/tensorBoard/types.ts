// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IInstaller } from '../common/types';

export const ITensorBoardSessionProvider = Symbol('ITensorBoardSessionProvider');

export interface ITensorBoardSessionProvider {
    createNewSession(installer: IInstaller): Promise<void>;
}
