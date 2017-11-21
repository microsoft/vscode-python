// tslint:disable-next-line:no-import-side-effect
import 'reflect-metadata';
import { IServiceManager } from '../../ioc/types';
import { EnvironmentVariablesService } from './environment';
import { EnvironmentVariablesProvider } from './environmentVariablesProvider';
import { IEnvironmentVariablesProvider, IEnvironmentVariablesService } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IEnvironmentVariablesService>(IEnvironmentVariablesService, EnvironmentVariablesService);
    serviceManager.addSingleton<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider, EnvironmentVariablesProvider);
}
