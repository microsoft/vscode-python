// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export const IDataScience = Symbol('IDataScience');
export interface IDataScience {
    activate(): Promise<void>;
    executeDataScience(): Promise<void>;
}
