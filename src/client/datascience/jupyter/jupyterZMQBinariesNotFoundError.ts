// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export class JupyterZMQBinariesNotFoundError extends Error {
    constructor(message: string) {
        super(message);
    }
}
