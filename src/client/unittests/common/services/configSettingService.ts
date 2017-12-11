import { Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { Product } from '../../../common/types';
import { ITestConfigSettingsService, UnitTestProduct } from './../types';

export class TestConfigSettingsService implements ITestConfigSettingsService {
    private static getTestArgSetting(product: UnitTestProduct) {
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
    private static getTestEnablingSetting(product: UnitTestProduct) {
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
    private static async updateSetting(testDirectory: string | Uri, setting: string, value: any) {
        let pythonConfig: WorkspaceConfiguration;
        const resource = typeof testDirectory === 'string' ? Uri.file(testDirectory) : testDirectory;
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            pythonConfig = workspace.getConfiguration('python');
        } else if (workspace.workspaceFolders.length === 1) {
            pythonConfig = workspace.getConfiguration('python', workspace.workspaceFolders[0].uri);
        } else {
            const workspaceFolder = workspace.getWorkspaceFolder(resource);
            if (!workspaceFolder) {
                throw new Error(`Test directory does not belong to any workspace (${testDirectory})`);
            }
            // tslint:disable-next-line:no-non-null-assertion
            pythonConfig = workspace.getConfiguration('python', workspaceFolder!.uri);
        }

        return pythonConfig.update(setting, value);
    }
    public async updateTestArgs(testDirectory: string | Uri, product: UnitTestProduct, args: string[]) {
        const setting = TestConfigSettingsService.getTestArgSetting(product);
        return TestConfigSettingsService.updateSetting(testDirectory, setting, args);
    }

    public async enable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void> {
        const setting = TestConfigSettingsService.getTestEnablingSetting(product);
        return TestConfigSettingsService.updateSetting(testDirectory, setting, true);
    }

    public async disable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void> {
        const setting = TestConfigSettingsService.getTestEnablingSetting(product);
        return TestConfigSettingsService.updateSetting(testDirectory, setting, false);
    }
}
