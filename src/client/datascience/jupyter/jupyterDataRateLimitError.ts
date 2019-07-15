// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as localize from '../../common/utils/localize';

export class JupyterDataRateLimitError extends Error {
    constructor() {
        super(localize.DataScience.jupyterDataRateExceeded());
    }
}
