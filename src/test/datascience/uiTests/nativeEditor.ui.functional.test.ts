// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any no-invalid-this no-console

import { nbformat } from '@jupyterlab/coreutils';
import { assert, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { Disposable } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { UseCustomEditor } from '../../../datascience-ui/react-common/constants';
import { getOSType, OSType, retryIfFail as retryIfFailOriginal } from '../../common';
import { mockedVSCodeNamespaces } from '../../vscode-mock';
import { DataScienceIocContainer } from '../dataScienceIocContainer';
import { addMockData } from '../testHelpersCore';
import { waitTimeForUIToUpdate } from './helpers';
import { openNotebook } from './notebookHelpers';
import { NotebookEditorUI } from './notebookUi';

const sanitize = require('sanitize-filename');
// Include default timeout.
const retryIfFail = <T>(fn: () => Promise<T>) => retryIfFailOriginal<T>(fn, waitTimeForUIToUpdate);

use(chaiAsPromised);

[false].forEach(useCustomEditorApi => {
    //import { asyncDump } from '../common/asyncDump';
    suite(`${useCustomEditorApi ? 'With' : 'Without'} Custom Editor API`, () => {
        const disposables: Disposable[] = [];
        let ioc: DataScienceIocContainer;

        suiteSetup(function() {
            // These are UI tests, hence nothing to do with platforms.
            // Skip windows, as that is slow.
            if (getOSType() === OSType.Windows) {
                return this.skip();
            }
            UseCustomEditor.enabled = useCustomEditorApi;
            this.timeout(30_000); // UI Tests, need time to start jupyter.
            this.retries(3); // UI Tests can be flaky.
        });
        setup(async () => {
            UseCustomEditor.enabled = useCustomEditorApi;
            ioc = new DataScienceIocContainer(true);
            ioc.registerDataScienceTypes(useCustomEditorApi);
            await ioc.activate();
        });
        teardown(async () => {
            sinon.restore();
            mockedVSCodeNamespaces.window?.reset();
            for (const disposable of disposables) {
                if (!disposable) {
                    continue;
                }
                // tslint:disable-next-line:no-any
                const promise = disposable.dispose() as Promise<any>;
                if (promise) {
                    await promise;
                }
            }
            await ioc.dispose();
            mockedVSCodeNamespaces.window?.reset();
        });
        let notebookUi: NotebookEditorUI;
        teardown(async function() {
            if (this.test && this.test.state === 'failed') {
                const imageName = `${sanitize(this.test.fullTitle())}.png`;
                await notebookUi.captureScreenshot(path.join(os.tmpdir(), 'tmp', 'screenshots', imageName));
                // await notebookUi.captureScreenshot(path.join(EXTENSION_ROOT_DIR, 'tmp', 'screenshots', imageName));
            }
        });
        function getIpynbFilePath(fileName: string) {
            return path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience', 'uiTests', 'notebooks', fileName);
        }
        async function openNotebookFile(ipynbFile: string) {
            const fileContents = await fs.readFile(getIpynbFilePath(ipynbFile), 'utf8');
            // Remove kernel information (in tests, use the current environment), ignore what others used.
            const nb = JSON.parse(fileContents) as nbformat.INotebookContent;
            if (nb.metadata && nb.metadata.kernelspec) {
                delete nb.metadata.kernelspec;
            }
            const result = await openNotebook(ioc, disposables, JSON.stringify(nb));
            notebookUi = result.notebookUI;
            return result;
        }
        async function openABCIpynb() {
            addMockData(ioc, 'a=1\na', 1);
            addMockData(ioc, 'b=2\nb', 2);
            addMockData(ioc, 'c=3\nc', 3);
            return openNotebookFile('simple_abc.ipynb');
        }
        async function openStandardWidgetsIpynb() {
            return openNotebookFile('standard_widgets.ipynb');
        }

        test('Notebook has 3 cells', async () => {
            const { notebookUI } = await openABCIpynb();
            await retryIfFail(async () => {
                const count = await notebookUI.getCellCount();
                assert.equal(count, 3);
            });
        });
        test('Output displayed after executing a cell', async () => {
            const { notebookUI } = await openABCIpynb();
            let hasOutput = await notebookUI.cellHasOutput(0);
            assert.isFalse(hasOutput);

            await notebookUI.executeCell(0);

            await retryIfFail(async () => {
                hasOutput = await notebookUI.cellHasOutput(0);
                assert.isTrue(hasOutput);
                const outputHtml = await notebookUI.getCellOutputHTML(0);
                assert.include(outputHtml, '<span>1</span>');
            });
        });
        suite('Standard IPyWidgets', () => {
            setup(function() {
                if (ioc.mockJupyter) {
                    return this.skip();
                }
            });

            test('Slider Widget', async () => {
                const { notebookUI } = await openStandardWidgetsIpynb();
                let hasOutput = await notebookUI.cellHasOutput(1);
                assert.isFalse(hasOutput);

                await notebookUI.executeCell(0);

                await retryIfFail(async () => {
                    hasOutput = await notebookUI.cellHasOutput(0);
                    assert.isTrue(hasOutput);
                    const outputHtml = await notebookUI.getCellOutputHTML(0);

                    // Should not contain the string representation of widget (rendered when ipywidgets wasn't supported).
                    // We should only render widget not string representation.
                    assert.notInclude(outputHtml, 'IntSlider(value=0)');

                    // Ensure Widget HTML exists
                    assert.include(outputHtml, 'jupyter-widgets');
                    assert.include(outputHtml, 'ui-slider');
                    assert.include(outputHtml, '<div class="ui-slider');
                });
            });
            test('Text Widget', async () => {
                const { notebookUI } = await openStandardWidgetsIpynb();
                let hasOutput = await notebookUI.cellHasOutput(1);
                assert.isFalse(hasOutput);

                await notebookUI.executeCell(1);

                await retryIfFail(async () => {
                    hasOutput = await notebookUI.cellHasOutput(1);
                    assert.isTrue(hasOutput);
                    const outputHtml = await notebookUI.getCellOutputHTML(1);

                    // Ensure Widget HTML exists
                    assert.include(outputHtml, 'jupyter-widgets');
                    assert.include(outputHtml, 'widget-text');
                    assert.include(outputHtml, '<input type="text');
                });
            });
            test('Checkox Widget', async () => {
                const { notebookUI } = await openStandardWidgetsIpynb();
                let hasOutput = await notebookUI.cellHasOutput(2);
                assert.isFalse(hasOutput);

                await notebookUI.executeCell(2);

                await retryIfFail(async () => {
                    hasOutput = await notebookUI.cellHasOutput(2);
                    assert.isTrue(hasOutput);
                    const outputHtml = await notebookUI.getCellOutputHTML(2);

                    // Ensure Widget HTML exists
                    assert.include(outputHtml, 'jupyter-widgets');
                    assert.include(outputHtml, 'widget-checkbox');
                    assert.include(outputHtml, '<input type="checkbox');
                });
            });
            test('Button Interaction across Cells', async () => {
                const { notebookUI } = await openStandardWidgetsIpynb();
                await assert.eventually.isFalse(notebookUI.cellHasOutput(3));
                await assert.eventually.isFalse(notebookUI.cellHasOutput(4));

                await notebookUI.executeCell(3);
                await notebookUI.executeCell(4);
                // await sleep(500_000);
                const button = await retryIfFail(async () => {
                    // Find the button & the lable in cell output for 3 & 4 respectively.
                    const buttons = await (await notebookUI.getCellOutput(3)).$$('button.widget-button');
                    const cell4Output = await notebookUI.getCellOutputHTML(4);

                    assert.equal(buttons.length, 1, 'No button');
                    assert.include(cell4Output, 'Not Clicked');

                    return buttons[0];
                });

                await retryIfFail(async () => {
                    // When we click the button, the text in the label will get updated (i.e. output in Cell 4 will be udpated).
                    await button.click();

                    const cell4Output = await notebookUI.getCellOutputHTML(4);
                    assert.include(cell4Output, 'Button Clicked');
                });
            });
        });
    });
});
