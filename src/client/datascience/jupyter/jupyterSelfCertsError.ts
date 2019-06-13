// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

export class JupyterSelfCertsError extends Error {
    constructor(message: string) {
        super(message);
    }
}
