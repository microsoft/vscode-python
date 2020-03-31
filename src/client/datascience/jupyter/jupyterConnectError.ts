// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

export class JupyterConnectError extends Error {
    constructor(message: string, stderr?: string) {
        super(message + (stderr ? `\n${stderr}` : ''));
    }
}
