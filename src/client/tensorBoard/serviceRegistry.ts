import { IServiceManager } from '../ioc/types';
import { TensorBoardSessionProvider } from './tensorBoardSessionProvider';
import { ITensorBoardSessionProvider } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ITensorBoardSessionProvider>(ITensorBoardSessionProvider, TensorBoardSessionProvider);
}
