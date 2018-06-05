import { inject, injectable } from 'inversify';
import { Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { Product } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { ITestConfigSettingsService, UnitTestProduct } from './../types';

@injectable()
export class TestConfigSettingsService implements ITestConfigSettingsService {
    private readonly workspaceService: IWorkspaceService;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }
    public async updateTestArgs(testDirectory: string | Uri, product: UnitTestProduct, args: string[]) {
        const setting = this.getTestArgSetting(product);
        return this.updateSetting(testDirectory, setting, args);
    }

    public async enable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void> {
        const setting = this.getTestEnablingSetting(product);
        return this.updateSetting(testDirectory, setting, true);
    }

    public async disable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void> {
        const setting = this.getTestEnablingSetting(product);
        return this.updateSetting(testDirectory, setting, false);
    }
    private getTestArgSetting(product: UnitTestProduct) {
        switch (product) {
            case Product.unittest:
                return 'unitTest.unittestArgs';
            case Product.pytest:
                return 'unitTest.pyTestArgs';
            case Product.nosetest:
                return 'unitTest.nosetestArgs';
            default:
                throw new Error('Invalid Test Product');
        }
    }
    private getTestEnablingSetting(product: UnitTestProduct) {
        switch (product) {
            case Product.unittest:
                return 'unitTest.unittestEnabled';
            case Product.pytest:
                return 'unitTest.pyTestEnabled';
            case Product.nosetest:
                return 'unitTest.nosetestsEnabled';
            default:
                throw new Error('Invalid Test Product');
        }
    }
    // tslint:disable-next-line:no-any
    private async updateSetting(testDirectory: string | Uri, setting: string, value: any) {
        let pythonConfig: WorkspaceConfiguration;
        const resource = typeof testDirectory === 'string' ? Uri.file(testDirectory) : testDirectory;
        if (!this.workspaceService.hasWorkspaceFolders) {
            pythonConfig = this.workspaceService.getConfiguration('python');
        } else if (this.workspaceService.workspaceFolders!.length === 1) {
            pythonConfig = this.workspaceService.getConfiguration('python', this.workspaceService.workspaceFolders![0].uri);
        } else {
            const workspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
            if (!workspaceFolder) {
                throw new Error(`Test directory does not belong to any workspace (${testDirectory})`);
            }
            // tslint:disable-next-line:no-non-null-assertion
            pythonConfig = this.workspaceService.getConfiguration('python', workspaceFolder!.uri);
        }

        return pythonConfig.update(setting, value);
    }
}
