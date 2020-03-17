// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage } from '@jupyterlab/services';

export type KernelConnectionInformation = {
    id: string;
    name: string;
    model: Kernel.IModel;
    username: string;
    clientId: string;
    status: Kernel.Status;
    isReady: boolean;
    handleComms: boolean;
    info: KernelMessage.IInfoReply;
};
