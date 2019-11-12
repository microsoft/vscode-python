// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';
import * as localize from '../../common/utils/localize';

export class JupyterDebuggerPortNotAvailableError extends Error {
    constructor(portNumber: number, rangeBegin: number, rangeEnd: number) {
        super(
            portNumber === -1
                ? localize.DataScience.jupyterDebuggerPortNotAvailableSearchError().format(rangeBegin.toString(), rangeEnd.toString())
                : localize.DataScience.jupyterDebuggerPortNotAvailableError().format(portNumber.toString())
        );
    }
}
