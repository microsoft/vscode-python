import { inject, injectable } from 'inversify';
import { Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { Product } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { ITestConfigSettingsService } from '../../types';
import { UnitTestProduct } from './../types';

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
    public getTestEnablingSetting(product: UnitTestProduct) {
        switch (product) {
            case Product.unittest:
                return 'testing.unittestEnabled';
            case Product.pytest:
                return 'testing.pytestEnabled';
            case Product.nosetest:
                return 'testing.nosetestsEnabled';
            default:
                throw new Error('Invalid Test Product');
        }
    }
    private getTestArgSetting(product: UnitTestProduct) {
        switch (product) {
            case Product.unittest:
                return 'testing.unittestArgs';
            case Product.pytest:
                return 'testing.pytestArgs';
            case Product.nosetest:
                return 'testing.nosetestArgs';
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
            pythonConfig = this.workspaceService.getConfiguration(
                'python',
                this.workspaceService.workspaceFolders![0].uri,
            );
        } else {
            const workspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
            if (!workspaceFolder) {
                throw new Error(`Test directory does not belong to any workspace (${testDirectory})`);
            }
            // tslint:disable-next-line:no-non-null-assertion
            pythonConfig = this.workspaceService.getConfiguration('python', workspaceFolder.uri);
        }

        return pythonConfig.update(setting, value);
    }
}

export class BufferedTestConfigSettingsService implements ITestConfigSettingsService {
    private ops: [string, string | Uri, UnitTestProduct, string[]][];
    constructor() {
        this.ops = [];
    }

    public async updateTestArgs(testDirectory: string | Uri, product: UnitTestProduct, args: string[]) {
        this.ops.push(['updateTestArgs', testDirectory, product, args]);
    }

    public async enable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void> {
        this.ops.push(['enable', testDirectory, product, []]);
    }

    public async disable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void> {
        this.ops.push(['disable', testDirectory, product, []]);
    }

    public async apply(cfg: ITestConfigSettingsService) {
        const ops = this.ops;
        this.ops = [];
        // Note that earlier ops do not get rolled back if a later
        // one fails.
        for (const [op, testDir, prod, args] of ops) {
            switch (op) {
                case 'updateTestArgs':
                    await cfg.updateTestArgs(testDir, prod, args);
                    break;
                case 'enable':
                    await cfg.enable(testDir, prod);
                    break;
                case 'disable':
                    await cfg.disable(testDir, prod);
                    break;
                default:
                    break;
            }
        }
    }
    public getTestEnablingSetting(_: UnitTestProduct): string {
        throw new Error('Method not implemented.');
    }
}
