// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken } from 'vscode';
import { PythonEnvironment } from './types';

/** Private __pythonTools v1 contract, separate from the copied public API. */
export interface PythonToolEnvironmentRequest {
    resourcePath?: string;
    /** Selects an exact existing environment, including global/base; omission reuses or creates an isolated one. */
    pythonPath?: string;
}

export interface PythonToolQueryRequest {
    resourcePath?: string;
    includePackages?: boolean;
}

export interface PythonToolInstallRequest {
    resourcePath?: string;
    packages: string[];
}

/** execInfo.activatedRun ?? execInfo.run must be runnable without prior activation. */
export type PythonToolResult =
    | {
          status: 'success';
          environment: PythonEnvironment;
          resourcePath?: string;
          created?: boolean;
          packages?: { name: string; version?: string }[];
      }
    | {
          status: 'error';
          code: string;
          message: string;
          environment?: PythonEnvironment;
          resourcePath?: string;
      };

/** Cancellation throws after cleanup; unconfirmed cleanup returns an error result. */
export interface PythonToolsApi {
    readonly version: 1;
    /** Configures an isolated project environment by default, without extension-owned pickers. */
    configureEnvironment(request: PythonToolEnvironmentRequest, token: CancellationToken): Promise<PythonToolResult>;
    /** Reads the selection without creating an environment or changing the selection. */
    getEnvironment(request: PythonToolQueryRequest, token: CancellationToken): Promise<PythonToolResult>;
    /**
     * Requires an open workspace and a selected isolated environment. Missing selection returns
     * ENVIRONMENT_NOT_CONFIGURED; global Python and Conda base return ENVIRONMENT_NOT_ISOLATED.
     */
    installPackages(request: PythonToolInstallRequest, token: CancellationToken): Promise<PythonToolResult>;
}
