// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export namespace DataExplorerMessages {
    export const Started = 'started';
    export const UpdateSettings = 'update_settings';
}

// Map all messages to specific payloads
export class IDataExplorerMapping {
    public [DataExplorerMessages.Started]: never | undefined;
    public [DataExplorerMessages.UpdateSettings]: string;
}
