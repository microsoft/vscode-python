// tslint:disable-next-line:no-import-side-effect
import 'reflect-metadata';
import { IServiceManager } from '../ioc/types';
import { IS_WINDOWS } from './types';
import { IS_WINDOWS as isWindows } from './utils';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<boolean>(IS_WINDOWS, isWindows);
}
