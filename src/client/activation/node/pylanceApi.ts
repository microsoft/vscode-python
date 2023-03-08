// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export interface PylanceApi {
    client?: {
        isEnabled(): boolean;
        start(): Promise<void>;
        stop(): Promise<void>;
    };
}
