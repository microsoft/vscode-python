import { OutputChannel, Uri } from 'vscode';
import { IPythonExecutionFactory } from '../../common/process/types';
import { IServiceContainer } from '../../ioc/types';
import { TestManagerService } from './testManagerService';
import { ITestCollectionStorageService, ITestDebugLauncher, ITestManagerService, ITestManagerServiceFactory, ITestResultsService, ITestsHelper } from './types';

export class TestManagerServiceFactory implements ITestManagerServiceFactory {
    constructor(private outChannel: OutputChannel, private testCollectionStorage: ITestCollectionStorageService,
        private testResultsService: ITestResultsService, private testsHelper: ITestsHelper,
        private debugLauncher: ITestDebugLauncher, private serviceContainer: IServiceContainer) { }
    public createTestManagerService(wkspace: Uri): ITestManagerService {
        return new TestManagerService(wkspace, this.outChannel, this.testCollectionStorage, this.testResultsService, this.testsHelper, this.debugLauncher, this.serviceContainer);
    }
}
