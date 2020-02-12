// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';
import * as localize from '../../common/utils/localize';

export class JupyterDebuggerPortBlockedError extends Error {
    constructor(portNumber: number, rangeBegin: number, rangeEnd: number) {
        super(
            portNumber === -1
                ? localize.DataScience.jupyterDebuggerPortBlockedSearchError().format(
                      rangeBegin.toString(),
                      rangeEnd.toString()
                  )
                : localize.DataScience.jupyterDebuggerPortBlockedError().format(portNumber.toString())
        );
    }
}
