import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { TestConfigurationManager } from '../common/managers/testConfigurationManager';
import { ITestConfigSettingsService } from '../types';

export class ConfigurationManager extends TestConfigurationManager {
    constructor(workspace: Uri, serviceContainer: IServiceContainer, cfg?: ITestConfigSettingsService) {
        super(workspace, Product.nosetest, serviceContainer, cfg);
    }
    public async requiresUserToConfigure(wkspace: Uri): Promise<boolean> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        for (const cfg of ['.noserc', 'nose.cfg']) {
            if (await fs.fileExists(path.join(wkspace.fsPath, cfg))) {
                return true;
            }
        }
        return false;
    }
    public async configure(wkspace: Uri): Promise<void> {
        const args: string[] = [];
        const configFileOptionLabel = 'Use existing config file';
        // If a config file exits, there's nothing to be configured.
        if (await this.requiresUserToConfigure(wkspace)) {
            return;
        }
        const subDirs = await this.getTestDirs(wkspace.fsPath);
        const testDir = await this.selectTestDir(wkspace.fsPath, subDirs);
        if (typeof testDir === 'string' && testDir !== configFileOptionLabel) {
            args.push(testDir);
        }
        const installed = await this.installer.isInstalled(Product.nosetest);
        if (!installed) {
            await this.installer.install(Product.nosetest);
        }
        await this.testConfigSettingsService.updateTestArgs(wkspace.fsPath, Product.nosetest, args);
    }
}
