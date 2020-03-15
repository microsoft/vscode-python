import * as path from 'path';
import { OutputChannel, QuickPickItem, Uri } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { traceInfo } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IInstaller, IOutputChannel } from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import { IServiceContainer } from '../../../ioc/types';
import { ITestConfigSettingsService, ITestConfigurationManager } from '../../types';
import { TEST_OUTPUT_CHANNEL, UNIT_TEST_PRODUCTS } from '../constants';
import { UnitTestProduct } from '../types';

export abstract class TestConfigurationManager implements ITestConfigurationManager {
    protected readonly outputChannel: OutputChannel;
    protected readonly installer: IInstaller;
    protected readonly testConfigSettingsService: ITestConfigSettingsService;
    constructor(
        protected workspace: Uri,
        protected product: UnitTestProduct,
        protected readonly serviceContainer: IServiceContainer,
        cfg?: ITestConfigSettingsService
    ) {
        this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        this.installer = serviceContainer.get<IInstaller>(IInstaller);
        this.testConfigSettingsService = cfg
            ? cfg
            : serviceContainer.get<ITestConfigSettingsService>(ITestConfigSettingsService);
    }
    public abstract configure(wkspace: Uri): Promise<void>;
    public abstract requiresUserToConfigure(wkspace: Uri): Promise<boolean>;
    public async enable() {
        // Disable other test frameworks.
        await Promise.all(
            UNIT_TEST_PRODUCTS.filter(prod => prod !== this.product).map(prod =>
                this.testConfigSettingsService.disable(this.workspace, prod)
            )
        );
        await this.testConfigSettingsService.enable(this.workspace, this.product);
    }
    // tslint:disable-next-line:no-any
    public async disable() {
        return this.testConfigSettingsService.enable(this.workspace, this.product);
    }
    protected selectTestDir(rootDir: string, subDirs: string[], customOptions: QuickPickItem[] = []): Promise<string> {
        const options = {
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Select the directory containing the tests'
        };
        let items: QuickPickItem[] = subDirs
            .map(dir => {
                const dirName = path.relative(rootDir, dir);
                if (dirName.indexOf('.') === 0) {
                    return;
                }
                return {
                    label: dirName,
                    description: ''
                };
            })
            .filter(item => item !== undefined)
            .map(item => item!);

        items = [{ label: '.', description: 'Root directory' }, ...items];
        items = customOptions.concat(items);
        const def = createDeferred<string>();
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        appShell.showQuickPick(items, options).then(item => {
            if (!item) {
                this.handleCancelled(); // This will throw an exception.
                return;
            }

            def.resolve(item.label);
        });

        return def.promise;
    }

    protected selectTestFilePattern(): Promise<string> {
        const options = {
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Select the pattern to identify test files'
        };
        const items: QuickPickItem[] = [
            { label: '*test.py', description: "Python Files ending with 'test'" },
            { label: '*_test.py', description: "Python Files ending with '_test'" },
            { label: 'test*.py', description: "Python Files beginning with 'test'" },
            { label: 'test_*.py', description: "Python Files beginning with 'test_'" },
            { label: '*test*.py', description: "Python Files containing the word 'test'" }
        ];

        const def = createDeferred<string>();
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        appShell.showQuickPick(items, options).then(item => {
            if (!item) {
                this.handleCancelled(); // This will throw an exception.
                return;
            }

            def.resolve(item.label);
        });

        return def.promise;
    }
    protected getTestDirs(rootDir: string): Promise<string[]> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        return fs.getSubDirectories(rootDir).then(subDirs => {
            subDirs.sort();

            // Find out if there are any dirs with the name test and place them on the top.
            const possibleTestDirs = subDirs.filter(dir => dir.match(/test/i));
            const nonTestDirs = subDirs.filter(dir => possibleTestDirs.indexOf(dir) === -1);
            possibleTestDirs.push(...nonTestDirs);

            // The test dirs are now on top.
            return possibleTestDirs;
        });
    }

    private handleCancelled() {
        traceInfo('testing configuration (in UI) cancelled');
        throw Error('cancelled');
    }
}
