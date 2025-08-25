// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ApiForPylance, TelemetryReporter } from '../pylanceApi';

export interface IBrowserExtensionApi {
    /**
     * @deprecated Temporarily exposed for Pylance until we expose this API generally. Will be removed in an
     * iteration or two.
     */
    pylance: ApiForPylance;
}

export function buildApi(reporter: TelemetryReporter): IBrowserExtensionApi {
    const api: IBrowserExtensionApi = {
        pylance: {
            getTelemetryReporter: () => reporter,
        },
    };

    return api;
}
