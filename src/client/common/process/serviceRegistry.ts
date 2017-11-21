// tslint:disable-next-line:no-import-side-effect
import 'reflect-metadata';
import { IServiceManager } from '../../ioc/types';
import { BufferDecoder } from './decoder';
import { ProcessService } from './proc';
import { PythonExecutionFactory } from './pythonExecutionFactory';
import { PythonExecutionService } from './pythonProcess';
import { IBufferDecoder, IProcessService, IPythonExecutionFactory, IPythonExecutionService } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
    serviceManager.addSingleton<IProcessService>(IProcessService, ProcessService);
    serviceManager.addSingleton<IPythonExecutionFactory>(IPythonExecutionFactory, PythonExecutionFactory);
}
