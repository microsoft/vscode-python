import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { IInstaller, Product } from '../../client/common/types';
import { rootWorkspaceUri } from '../common';
import { updateSetting } from '../common';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { closeActiveWindows, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';

// tslint:disable-next-line:no-suspicious-comment
// TODO: Need to mock the command runner, to check what commands are being sent.
// Instead of altering the environment.

suite('Installer', () => {
    let ioc: UnitTestIocContainer;
    const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
    suiteSetup(async function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await initializeTest();
    });
    setup(async () => {
        await initializeTest();
        await resetSettings();
        initializeDI();
    });
    suiteTeardown(async () => {
        await closeActiveWindows();
        await resetSettings();
    });
    teardown(async () => {
        ioc.dispose();
        closeActiveWindows();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
    }

    async function resetSettings() {
        await updateSetting('linting.enabledWithoutWorkspace', true, undefined, ConfigurationTarget.Global);
        await updateSetting('linting.pylintEnabled', true, rootWorkspaceUri, ConfigurationTarget.Workspace);
        if (IS_MULTI_ROOT_TEST) {
            await updateSetting('linting.pylintEnabled', true, rootWorkspaceUri, ConfigurationTarget.WorkspaceFolder);
        }
    }

    test('Disable linting of files contained in a multi-root workspace', async function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        const installer = ioc.serviceContainer.get<IInstaller>(IInstaller);
        await installer.disableLinter(Product.pylint, workspaceUri);
        const pythonWConfig = workspace.getConfiguration('python', workspaceUri);
        const value = pythonWConfig.inspect<boolean>('linting.pylintEnabled');
        // tslint:disable-next-line:no-non-null-assertion
        assert.equal(value!.workspaceValue, true, 'Workspace setting has been disabled');
        // tslint:disable-next-line:no-non-null-assertion
        assert.equal(value!.workspaceFolderValue, false, 'Workspace folder setting not disabled');
    });
});
