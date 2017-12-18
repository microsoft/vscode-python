// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../../ioc/types';
import { BufferDecoder } from './decoder';
import { ProcessService } from './proc';
import { PythonExecutionFactory } from './pythonExecutionFactory';
import { IBufferDecoder, IProcessService, IPythonExecutionFactory } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
    serviceManager.addSingleton<IProcessService>(IProcessService, ProcessService);
    serviceManager.addSingleton<IPythonExecutionFactory>(IPythonExecutionFactory, PythonExecutionFactory);
}
