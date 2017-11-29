import { OutputChannel, Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { TestManagerService } from './testManagerService';
import { ITestCollectionStorageService, ITestManagerService, ITestManagerServiceFactory, ITestResultsService, ITestsHelper } from './types';

export class TestManagerServiceFactory implements ITestManagerServiceFactory {
    constructor(private outChannel: OutputChannel, private testCollectionStorage: ITestCollectionStorageService,
        private testResultsService: ITestResultsService, private testsHelper: ITestsHelper,
        private serviceContainer: IServiceContainer) { }
    public createTestManagerService(wkspace: Uri): ITestManagerService {
        return new TestManagerService(wkspace, this.outChannel, this.testCollectionStorage, this.testResultsService, this.testsHelper, this.serviceContainer);
    }
}
