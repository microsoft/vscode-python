// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../ioc/types';
import { ProtocolParser } from './Common/protocolParser';
import { IProtocolParser } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.add<IProtocolParser>(IProtocolParser, ProtocolParser);
}
