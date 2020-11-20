// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const ITensorBoardSessionProvider = Symbol('ITensorBoardSessionProvider');

export interface ITensorBoardSessionProvider {
    createNewSession(): Promise<void>;
}
