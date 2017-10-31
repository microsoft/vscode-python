import * as assert from 'assert';
import * as path from 'path';
import { Uri } from 'vscode';
import { EnumEx } from '../../client/common/enumUtils';
import { Installer, Product } from '../../client/common/installer';
import { closeActiveWindows, initializeTest, IS_MULTI_ROOT_TEST, IS_TRAVIS } from './../initialize';
import { MockOutputChannel } from './../mockClasses';

// TODO: Need to mock the command runner, to check what commands are being sent.
// Instead of altering the environment.

suite('Installer', () => {
    let outputChannel: MockOutputChannel;
    let installer: Installer;
    const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
    const resource = IS_MULTI_ROOT_TEST ? workspaceUri : undefined;
    suiteSetup(async () => {
        outputChannel = new MockOutputChannel('Installer');
        installer = new Installer(outputChannel);
        await initializeTest();
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    async function testUninstallingProduct(product: Product) {
        let isInstalled = await installer.isInstalled(product, resource);
        if (isInstalled) {
            await installer.uninstall(product, resource);
            isInstalled = await installer.isInstalled(product, resource);
            // Someimtes installation doesn't work on Travis
            if (!IS_TRAVIS) {
                assert.equal(isInstalled, false, 'Product uninstall failed');
            }
        }
    }

    EnumEx.getNamesAndValues<Product>(Product).forEach(prod => {
        test(`${prod.name} : Uninstall`, async () => {
            if (prod.value === Product.unittest || prod.value === Product.ctags) {
                return;
            }
            await testUninstallingProduct(prod.value);
        });
    });

    async function testInstallingProduct(product: Product) {
        const isInstalled = await installer.isInstalled(product, resource);
        if (!isInstalled) {
            await installer.install(product, resource);
        }
        const checkIsInstalledAgain = await installer.isInstalled(product, resource);
        // Someimtes installation doesn't work on Travis
        if (!IS_TRAVIS) {
            assert.notEqual(checkIsInstalledAgain, false, 'Product installation failed');
        }
    }
    EnumEx.getNamesAndValues<Product>(Product).forEach(prod => {
        test(`${prod.name} : Install`, async () => {
            if (prod.value === Product.unittest || prod.value === Product.ctags) {
                return;
            }
            await testInstallingProduct(prod.value);
        });
    });
});
