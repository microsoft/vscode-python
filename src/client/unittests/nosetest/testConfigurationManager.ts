import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { IInstaller, Product } from '../../common/types';
import { TestConfigurationManager } from '../common/managers/testConfigurationManager';
import { ITestConfigSettingsService } from '../common/types';

export class ConfigurationManager extends TestConfigurationManager {
    constructor(workspace: Uri, outputChannel: vscode.OutputChannel,
        installer: IInstaller, testConfigSettingsService: ITestConfigSettingsService) {
        super(workspace, Product.nosetest, outputChannel, installer, testConfigSettingsService);
    }
    private static async configFilesExist(rootDir: string): Promise<string[]> {
        const promises = ['.noserc', 'nose.cfg'].map(cfg => {
            return new Promise<string>(resolve => {
                fs.exists(path.join(rootDir, cfg), exists => { resolve(exists ? cfg : ''); });
            });
        });
        const values = await Promise.all(promises);
        return values.filter(exists => exists.length > 0);
    }
    // tslint:disable-next-line:no-any
    public async configure(wkspace: Uri): Promise<any> {
        const args: string[] = [];
        const configFileOptionLabel = 'Use existing config file';
        const configFiles = await ConfigurationManager.configFilesExist(wkspace.fsPath);
        // If a config file exits, there's nothing to be configured.
        if (configFiles.length > 0) {
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
