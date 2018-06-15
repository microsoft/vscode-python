// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export const IApplicationDiagnostics = Symbol('IApplicationDiagnostics');

export interface IApplicationDiagnostics {
    /**
     * Perform pre-extension activation health checks.
     * E.g. validate user environment, etc.
     * @returns {Promise<void>}
     * @memberof IApplicationDiagnostics
     */
    performPreStartupHealthCheck(): Promise<void>;
}
