// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import { IApplicationShell } from '../../../../client/common/application/types';
import { ProductNames } from '../../../../client/common/installer/productNames';
import { BufferDecoder } from '../../../../client/common/process/decoder';
import { ProcessService } from '../../../../client/common/process/proc';
import { IDisposable, IInstaller, InstallerResponse, Product } from '../../../../client/common/types';
import { createDeferred } from '../../../../client/common/utils/async';
import { Common, DataScience } from '../../../../client/common/utils/localize';
import { INotebookEditorProvider } from '../../../../client/datascience/types';
import { IS_CI_SERVER } from '../../../ciConstants';
import { getOSType, IExtensionTestApi, OSType, waitForCondition } from '../../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { closeActiveWindows, initialize } from '../../../initialize';
import { openNotebook } from '../../helpers';
import { closeNotebooksAndCleanUpAfterTests } from '../../notebook/helper';

// tslint:disable: no-invalid-this max-func-body-length no-function-expression no-any
suite('DataScience Install IPyKernel (slow) (install)', () => {
    const disposables: IDisposable[] = [];
    const nbFile = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src/test/datascience/jupyter/kernels/nbWithKernel.ipynb');
    const executable = getOSType() === OSType.Windows ? 'Scripts/python.exe' : 'bin/python'; // If running locally on Windows box.
    const venvPythonPath = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src/test/datascience/.venvnokernel', executable);
    const expectedPromptMessageSuffix = `requires ${ProductNames.get(Product.ipykernel)!} to be installed.`;

    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    let appShell: IApplicationShell;
    let installer: IInstaller;
    const delayForUITest = 30_000;
    /*
    This test requires a virtual environment to be created & registered as a kernel.
    It also needs to have ipykernel installed in it.
    */
    suiteSetup(async function () {
        this.timeout(60_000); // Slow test, we need to uninstall/install ipykernel.

        // These are slow tests, hence lets run only on linux on CI.
        if ((IS_CI_SERVER && getOSType() !== OSType.Linux) || !fs.pathExistsSync(venvPythonPath)) {
            // Virtual env does not exist.
            return this.skip();
        }
        api = await initialize();
        appShell = api.serviceContainer.get<IApplicationShell>(IApplicationShell);
        installer = api.serviceContainer.get<IInstaller>(IInstaller);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);

        // Uninstall ipykernel from the virtual env.
        const proc = new ProcessService(new BufferDecoder());
        await proc.exec(venvPythonPath, ['-m', 'pip', 'uninstall', 'ipykernel', '--yes']);
    });

    setup(closeActiveWindows);
    teardown(() => closeNotebooksAndCleanUpAfterTests(disposables));

    test('Test Install IPyKernel prompt message', async () => {
        // Confirm the message has not changed.
        assert.ok(
            DataScience.libraryRequiredToLaunchJupyterKernelNotInstalledInterpreter()
                .format('', ProductNames.get(Product.ipykernel)!)
                .endsWith(expectedPromptMessageSuffix),
            'Message has changed, please update this test'
        );
    });

    test('Ensure prompt is displayed when ipykernel module is not found and it gets installed', async () => {
        const promptDisplayed = createDeferred();
        const installed = createDeferred();

        // Confirm it is installed.
        const showInformationMessage = sinon.stub(installer, 'install').callsFake(async function (product: Product) {
            // Call original method
            const result: InstallerResponse = await ((installer.install as any).wrappedMethod.apply(
                installer,
                arguments
            ) as Promise<InstallerResponse>);
            if (product === Product.ipykernel && result === InstallerResponse.Installed) {
                installed.resolve();
            }
            return result;
        });
        disposables.push({ dispose: () => showInformationMessage.restore() });

        // Confirm message is displayed & we click 'Install` button.
        sinon.stub(appShell, 'showErrorMessage').callsFake(function (message: string) {
            if (message.endsWith(expectedPromptMessageSuffix)) {
                promptDisplayed.resolve();
                // User clicked ok to install it.
                return Common.install();
            }
            return (appShell.showErrorMessage as any).wrappedMethod.apply(appShell, arguments);
        });

        await openNotebook(api.serviceContainer, nbFile);

        // Run all cells
        editorProvider.activeEditor!.runAllCells();

        // The prompt should be displayed & ipykernel should get installed.
        await waitForCondition(
            async () => {
                await Promise.all([promptDisplayed.promise, installed.promise]);
                return true;
            },
            delayForUITest,
            'Prompt not displayed or not installed successfully'
        );
    });
});
