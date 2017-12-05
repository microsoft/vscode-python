import { OutputChannel, Uri } from 'vscode';
import { Installer, Product } from '../../common/installer';
import { TestConfigurationManager } from '../common/managers/testConfigurationManager';
import { ITestConfigSettingsService } from '../common/types';

export class ConfigurationManager extends TestConfigurationManager {
    constructor(workspace: Uri, outputChannel: OutputChannel,
        installer: Installer, testConfigSettingsService: ITestConfigSettingsService) {
        super(workspace, Product.unittest, outputChannel, installer, testConfigSettingsService);
    }
    // tslint:disable-next-line:no-any
    public async configure(wkspace: Uri) {
        const args = ['-v'];
        const subDirs = await this.getTestDirs(wkspace.fsPath);
        const testDir = await this.selectTestDir(wkspace.fsPath, subDirs);
        args.push('-s');
        if (typeof testDir === 'string' && testDir !== '.') {
            args.push(`./${testDir}`);
        } else {
            args.push('.');
        }

        const testfilePattern = await this.selectTestFilePattern();
        args.push('-p');
        if (typeof testfilePattern === 'string') {
            args.push(testfilePattern);
        } else {
            args.push('test*.py');
        }
        await this.testConfigSettingsService.updateTestArgs(wkspace.fsPath, Product.unittest, args);
    }
}
