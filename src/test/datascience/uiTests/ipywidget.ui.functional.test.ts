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
import { LocalZMQKernel } from '../../../client/common/experiments/groups';
import { sleep } from '../../../client/common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { retryIfFail as retryIfFailOriginal } from '../../common';
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

[false, true].forEach((useRawKernel) => {
    //import { asyncDump } from '../common/asyncDump';
    suite(`DataScience IPyWidgets (${useRawKernel ? 'With Direct Kernel' : 'With Jupyter Server'})`, () => {
        const disposables: Disposable[] = [];
        let ioc: DataScienceIocContainer;

        suiteSetup(function () {
            // These are UI tests, hence nothing to do with platforms.
            this.timeout(30_000); // UI Tests, need time to start jupyter.
            this.retries(3); // UI tests can be flaky.
            if (!process.env.VSCODE_PYTHON_ROLLING) {
                // Skip all tests unless using real jupyter
                this.skip();
            }
        });
        setup(async function () {
            ioc = new DataScienceIocContainer(true);
            ioc.setExtensionRootPath(EXTENSION_ROOT_DIR);
            if (ioc.mockJupyter && useRawKernel) {
                // tslint:disable-next-line: no-invalid-this
                this.skip();
            } else {
                ioc.setExperimentState(LocalZMQKernel.experiment, useRawKernel);
            }

            ioc.registerDataScienceTypes();

            // Make sure we force auto start (we wait for kernel idle before running)
            ioc.forceSettingsChanged(undefined, ioc.getSettings().pythonPath, {
                ...ioc.getSettings().datascience,
                disableJupyterAutoStart: false
            });

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
        teardown(async function () {
            if (this.test && this.test.state === 'failed') {
                const imageName = `${sanitize(this.currentTest?.title)}.png`;
                await notebookUi.captureScreenshot(path.join(os.tmpdir(), 'tmp', 'screenshots', imageName));
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
            // Clear all output (from previous executions).
            nb.cells.forEach((cell) => {
                if (Array.isArray(cell.outputs)) {
                    cell.outputs = [];
                }
            });
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
        async function openIPySheetsIpynb() {
            return openNotebookFile('ipySheet_widgets.ipynb');
        }
        async function openBeakerXIpynb() {
            return openNotebookFile('beakerx_widgets.ipynb');
        }
        async function openK3DIpynb() {
            return openNotebookFile('k3d_widgets.ipynb');
        }
        async function openBqplotIpynb() {
            return openNotebookFile('bqplot_widgets.ipynb');
        }
        async function openIPyVolumeIpynb() {
            return openNotebookFile('ipyvolume_widgets.ipynb');
        }
        async function openPyThreejsIpynb() {
            return openNotebookFile('pythreejs_widgets.ipynb');
        }
        async function openOutputAndInteractIpynb() {
            return openNotebookFile('outputinteract_widgets.ipynb');
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
            await assert.eventually.isFalse(notebookUI.cellHasOutput(0));

            await notebookUI.executeCell(0);

            await retryIfFail(async () => {
                await assert.eventually.isTrue(notebookUI.cellHasOutput(0));
                const outputHtml = await notebookUI.getCellOutputHTML(0);
                assert.include(outputHtml, '<span>1</span>');
            });
        });

        async function openNotebookAndTestSliderWidget() {
            const result = await openStandardWidgetsIpynb();
            const notebookUI = result.notebookUI;
            await assert.eventually.isFalse(notebookUI.cellHasOutput(0));

            await verifySliderWidgetIsAvailableAfterExecution(notebookUI);

            return result;
        }
        async function verifySliderWidgetIsAvailableAfterExecution(notebookUI: NotebookEditorUI) {
            await notebookUI.executeCell(0);

            // Slider output could take a bit. Wait some
            await sleep(2000);

            await retryIfFail(async () => {
                await assert.eventually.isTrue(notebookUI.cellHasOutput(0));
                const outputHtml = await notebookUI.getCellOutputHTML(0);

                // Should not contain the string representation of widget (rendered when ipywidgets wasn't supported).
                // We should only render widget not string representation.
                assert.notInclude(outputHtml, 'IntSlider(value=0)');

                // Ensure Widget HTML exists
                assert.include(outputHtml, 'jupyter-widgets');
                assert.include(outputHtml, 'ui-slider');
                assert.include(outputHtml, '<div class="ui-slider');
            });
        }
        test('Slider Widget', openNotebookAndTestSliderWidget);
        test('Text Widget', async () => {
            const { notebookUI } = await openStandardWidgetsIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(1));

            await notebookUI.executeCell(1);

            await retryIfFail(async () => {
                await assert.eventually.isTrue(notebookUI.cellHasOutput(1));
                const outputHtml = await notebookUI.getCellOutputHTML(1);

                // Ensure Widget HTML exists
                assert.include(outputHtml, 'jupyter-widgets');
                assert.include(outputHtml, 'widget-text');
                assert.include(outputHtml, '<input type="text');
            });
        });
        test('Checkbox Widget', async () => {
            const { notebookUI } = await openStandardWidgetsIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(2));

            await notebookUI.executeCell(2);

            await retryIfFail(async () => {
                await assert.eventually.isTrue(notebookUI.cellHasOutput(2));
                const outputHtml = await notebookUI.getCellOutputHTML(2);

                // Ensure Widget HTML exists
                assert.include(outputHtml, 'jupyter-widgets');
                assert.include(outputHtml, 'widget-checkbox');
                assert.include(outputHtml, '<input type="checkbox');
            });
        });
        test('Render ipysheets', async () => {
            const { notebookUI } = await openIPySheetsIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(3));

            await notebookUI.executeCell(1);
            await notebookUI.executeCell(3);

            await retryIfFail(async () => {
                const cellOutput = await notebookUI.getCellOutputHTML(3);

                // Confirm cells with output has been rendered.
                assert.include(cellOutput, 'Hello</td>');
                assert.include(cellOutput, 'World</td>');
            });
        });
        test('Widget renders after closing and re-opening notebook', async () => {
            const result = await openNotebookAndTestSliderWidget();

            await result.notebookUI.page?.close();
            await result.webViewPanel.dispose();

            // Open the same notebook again and test.
            await openNotebookAndTestSliderWidget();
        });
        test('Widget renders after restarting kernel', async () => {
            const { notebookUI, notebookEditor } = await openNotebookAndTestSliderWidget();

            // Clear the output
            await notebookUI.clearOutput();
            await retryIfFail(async () => notebookUI.cellHasOutput(0));

            // Restart the kernel.
            await notebookEditor.restartKernel();

            // Execute cell again and verify output is displayed.
            await verifySliderWidgetIsAvailableAfterExecution(notebookUI);
        });
        test('Widget renders after interrupting kernel', async () => {
            const { notebookUI, notebookEditor } = await openNotebookAndTestSliderWidget();

            // Clear the output
            await notebookUI.clearOutput();
            await retryIfFail(async () => notebookUI.cellHasOutput(0));

            // Restart the kernel.
            await notebookEditor.interruptKernel();

            // Execute cell again and verify output is displayed.
            await verifySliderWidgetIsAvailableAfterExecution(notebookUI);
        });
        test('Button Interaction across Cells', async () => {
            const { notebookUI } = await openStandardWidgetsIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(3));
            await assert.eventually.isFalse(notebookUI.cellHasOutput(4));

            await notebookUI.executeCell(3);
            await notebookUI.executeCell(4);

            const button = await retryIfFail(async () => {
                // Find the button & the lable in cell output for 3 & 4 respectively.
                const buttons = await (await notebookUI.getCellOutput(3)).$$('button.widget-button');
                const cell4Output = await notebookUI.getCellOutputHTML(4);

                assert.equal(buttons.length, 1, 'No button');
                assert.include(cell4Output, 'Not Clicked');

                return buttons[0];
            });

            // When we click the button, the text in the label will get updated (i.e. output in Cell 4 will be udpated).
            await button.click();

            await retryIfFail(async () => {
                const cell4Output = await notebookUI.getCellOutputHTML(4);
                assert.include(cell4Output, 'Button Clicked');
            });
        });
        test('Search ipysheets with textbox in another cell', async () => {
            const { notebookUI } = await openIPySheetsIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(6));
            await assert.eventually.isFalse(notebookUI.cellHasOutput(7));

            await notebookUI.executeCell(5);
            await notebookUI.executeCell(6);
            await notebookUI.executeCell(7);

            // Wait for sheets to get rendered.
            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(7);

                assert.include(cellOutputHtml, 'test</td>');
                assert.include(cellOutputHtml, 'train</td>');

                const cellOutput = await notebookUI.getCellOutput(6);
                const highlighted = await cellOutput.$$('td.htSearchResult');
                assert.equal(highlighted.length, 0);
            });

            // Type `test` into textbox.
            await retryIfFail(async () => {
                const cellOutput = await notebookUI.getCellOutput(6);
                const textboxes = await cellOutput.$$('input[type=text]');
                assert.equal(textboxes.length, 1, 'No Texbox');
                await textboxes[0].focus();

                await notebookUI.type('test');
            });

            // Confirm cell is filtered and highlighted.
            await retryIfFail(async () => {
                const cellOutput = await notebookUI.getCellOutput(7);
                const highlighted = await cellOutput.$$('td.htSearchResult');
                assert.equal(highlighted.length, 2);
            });
        });
        test('Update ipysheets cells with textbox & slider in another cell', async () => {
            const { notebookUI } = await openIPySheetsIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(10));
            await assert.eventually.isFalse(notebookUI.cellHasOutput(12));
            await assert.eventually.isFalse(notebookUI.cellHasOutput(13));

            await notebookUI.executeCell(9);
            await notebookUI.executeCell(10);
            await notebookUI.executeCell(12);
            await notebookUI.executeCell(13);

            // Wait for slider to get rendered with value `0`.
            const sliderLabel = await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(10);

                assert.include(cellOutputHtml, 'ui-slider-handle');
                assert.include(cellOutputHtml, 'left: 0%');

                const cellOutput = await notebookUI.getCellOutput(10);
                const sliderLables = await cellOutput.$$('div.widget-readout');

                return sliderLables[0];
            });

            // Confirm slider lable reads `0`.
            await retryIfFail(async () => {
                const sliderValue = await notebookUI.page?.evaluate((ele) => ele.innerHTML.trim(), sliderLabel);
                assert.equal(sliderValue || '', '0');
            });

            // Wait for textbox to get rendered.
            const textbox = await retryIfFail(async () => {
                const cellOutput = await notebookUI.getCellOutput(12);
                const textboxes = await cellOutput.$$('input[type=number]');
                assert.equal(textboxes.length, 1);

                const value = await notebookUI.page?.evaluate((el) => (el as HTMLInputElement).value, textboxes[0]);
                assert.equal(value || '', '0');

                return textboxes[0];
            });

            // Wait for sheets to get rendered.
            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(13);
                assert.include(cellOutputHtml, '>50.000</td>');
                assert.notInclude(cellOutputHtml, '>100.000</td>');
            });

            // Type `50` into textbox.
            await retryIfFail(async () => {
                await textbox.focus();
                await notebookUI.type('50');
            });

            // Confirm slider label reads `50`.
            await retryIfFail(async () => {
                const sliderValue = await notebookUI.page?.evaluate((ele) => ele.innerHTML.trim(), sliderLabel);
                assert.equal(sliderValue || '', '50');
            });

            // Wait for sheets to get updated with calculation.
            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(13);

                assert.include(cellOutputHtml, '>50.000</td>');
                assert.include(cellOutputHtml, '>100.000</td>');
            });
        });
        test('Render ipyvolume', async () => {
            const { notebookUI } = await openIPyVolumeIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(3));

            await notebookUI.executeCell(1);
            await notebookUI.executeCell(2);
            await notebookUI.executeCell(3);
            await notebookUI.executeCell(4);

            // Confirm sliders and canvas are rendered.
            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(1);
                assert.include(cellOutputHtml, '<canvas ');

                const cellOutput = await notebookUI.getCellOutput(1);
                const sliders = await cellOutput.$$('div.ui-slider');
                assert.equal(sliders.length, 2);
            });

            // Confirm canvas is rendered.
            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(4);
                assert.include(cellOutputHtml, '<canvas ');
            });
        });
        test('Render pythreejs', async () => {
            const { notebookUI } = await openPyThreejsIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(3));
            await assert.eventually.isFalse(notebookUI.cellHasOutput(8));

            await notebookUI.executeCell(1);
            await notebookUI.executeCell(2);
            await notebookUI.executeCell(3);
            await notebookUI.executeCell(4);
            await notebookUI.executeCell(5);
            await notebookUI.executeCell(6);
            await notebookUI.executeCell(7);
            await notebookUI.executeCell(8);

            // Confirm canvas is rendered.
            await retryIfFail(async () => {
                let cellOutputHtml = await notebookUI.getCellOutputHTML(3);
                assert.include(cellOutputHtml, '<canvas ');
                // Last cell is flakey. Can take too long to render. We need some way
                // to know when a widget is done rendering.
                cellOutputHtml = await notebookUI.getCellOutputHTML(8);
                assert.include(cellOutputHtml, '<canvas ');
            });
        });
        test('Render beakerx', async () => {
            const { notebookUI } = await openBeakerXIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(1));
            await assert.eventually.isFalse(notebookUI.cellHasOutput(2));

            await notebookUI.executeCell(1);
            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(1);
                // Confirm svg graph has been rendered.
                assert.include(cellOutputHtml, '<svg');

                // Confirm graph legened has been rendered.
                const cellOutput = await notebookUI.getCellOutput(1);
                const legends = await cellOutput.$$('div.plot-legend');
                assert.isAtLeast(legends.length, 1);
            });

            await notebookUI.executeCell(2);
            await retryIfFail(async () => {
                // Confirm graph modal dialog has been rendered.
                const cellOutput = await notebookUI.getCellOutput(2);
                const modals = await cellOutput.$$('div.modal-content');
                assert.isAtLeast(modals.length, 1);
            });
        });
        test('Render bqplot', async () => {
            const { notebookUI } = await openBqplotIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(2));
            await assert.eventually.isFalse(notebookUI.cellHasOutput(4));

            await notebookUI.executeCell(1);
            await notebookUI.executeCell(2);

            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(2);
                // Confirm svg graph has been rendered.
                assert.include(cellOutputHtml, '<svg');
                assert.include(cellOutputHtml, 'plotarea_events');
            });

            // Render empty plot
            await notebookUI.executeCell(4);
            await retryIfFail(async () => {
                const cellOutput = await notebookUI.getCellOutput(4);
                // Confirm no points have been rendered.
                const dots = await cellOutput.$$('path.dot');
                assert.equal(dots.length, 0);
            });

            // Draw points on previous plot.
            await notebookUI.executeCell(5);
            await retryIfFail(async () => {
                const cellOutput = await notebookUI.getCellOutput(4);
                // Confirm points have been rendered.
                const dots = await cellOutput.$$('path.dot');
                assert.isAtLeast(dots.length, 1);
            });

            // Chage color of plot points to red.
            await notebookUI.executeCell(7);
            await retryIfFail(async () => {
                const cellOutput = await notebookUI.getCellOutput(4);
                const dots = await cellOutput.$$('path.dot');
                assert.isAtLeast(dots.length, 1);
                const dotHtml = await notebookUI.page?.evaluate((ele) => ele.outerHTML, dots[0]);
                // Confirm color of dot is red.
                assert.include(dotHtml || '', 'red');
            });

            // Chage color of plot points to red.
            await notebookUI.executeCell(8);
            await retryIfFail(async () => {
                const cellOutput = await notebookUI.getCellOutput(4);
                const dots = await cellOutput.$$('path.dot');
                assert.isAtLeast(dots.length, 1);
                const dotHtml = await notebookUI.page?.evaluate((ele) => ele.outerHTML, dots[0]);
                // Confirm color of dot is red.
                assert.include(dotHtml || '', 'yellow');
            });
        });
        test('Render output and interact', async () => {
            const { notebookUI } = await openOutputAndInteractIpynb();
            await notebookUI.executeCell(0);
            await notebookUI.executeCell(1);

            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(1);
                // Confirm border is visible
                assert.include(cellOutputHtml, 'border');
            });

            // Run the cell that will stick output into the out border
            await notebookUI.executeCell(2);

            // Make sure output is shown
            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(1);
                // Confirm output went inside of previous cell
                assert.include(cellOutputHtml, 'Hello world');
            });

            // Make sure output on print cell is empty
            await retryIfFail(async () => {
                const cell = await notebookUI.getCell(2);
                const output = await cell.$$('.cell-output-wrapper');
                assert.equal(output.length, 0, 'Cell should not have any output');
            });

            // interact portion
            await notebookUI.executeCell(3);
            await notebookUI.executeCell(4);
            await notebookUI.executeCell(5);
            // See if we have a slider in our output
            const slider = await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(5);
                assert.include(cellOutputHtml, 'slider', 'Cell output should have rendered a slider');
                const sliderInner = await (await notebookUI.getCellOutput(5)).$$('.slider-container');
                assert.ok(sliderInner.length, 'Slider not found');
                return sliderInner[0];
            });

            // Click on the slider to change the value.
            const rect = await slider.boundingBox();
            if (rect) {
                await notebookUI.page?.mouse.move(rect?.x + 5, rect.y + rect.height / 2);
                await notebookUI.page?.mouse.down();
                await notebookUI.page?.mouse.up();
            }

            // Make sure the output value has changed to something other than 10
            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(5);
                assert.notInclude(cellOutputHtml, '<pre>10', 'Slider click did not update the span');
            });
        });
        test('Render k3d', async () => {
            const { notebookUI } = await openK3DIpynb();
            await assert.eventually.isFalse(notebookUI.cellHasOutput(3));
            await assert.eventually.isFalse(notebookUI.cellHasOutput(5));

            await notebookUI.executeCell(3);
            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(3);
                // Confirm svg graph has been rendered.
                assert.include(cellOutputHtml, '<canvas');
                // Toolbar should be rendered.
                assert.include(cellOutputHtml, 'Close Controls');
                // The containing element with a class of `k3d-target` should be rendered.
                assert.include(cellOutputHtml, 'k3d-target');
            });

            await notebookUI.executeCell(5);
            await retryIfFail(async () => {
                const cellOutputHtml = await notebookUI.getCellOutputHTML(5);
                // Slider should be rendered.
                assert.include(cellOutputHtml, 'ui-slider');
            });
        });
    });
});
