// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { nbformat } from '@jupyterlab/coreutils';
import { expect } from 'chai';
import { sha256 } from 'hash.js';
// tslint:disable-next-line: match-default-export-name
import rewiremock from 'rewiremock';
import { instance, mock, when } from 'ts-mockito';
import { EventEmitter, Uri } from 'vscode';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { Telemetry } from '../../../client/datascience/constants';
import { NativeEditor } from '../../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorProvider } from '../../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { NativeEditorStorage } from '../../../client/datascience/interactive-ipynb/nativeEditorStorage';
import { CellOutputMimeTypeTracker } from '../../../client/datascience/jupyter/jupyterCellOutputMimeTypeTracker';
import { CellState, ICell, INotebookEditor } from '../../../client/datascience/types';
import { FakeClock } from '../../common';

suite('Data Science - Cell Output Mimetype Tracker', () => {
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;
    let outputMimeTypeTracker: CellOutputMimeTypeTracker;
    let nativeProvider: NativeEditorProvider;
    let openedNotebookEmitter: EventEmitter<INotebookEditor>;
    let fakeTimer: FakeClock;
    class Reporter {
        public static telemetrySent: [string, Record<string, string>][] = [];
        public static expectHashes(props: {}[]) {
            const mimeTypeTelemetry = Reporter.telemetrySent.filter(
                item => item[0] === Telemetry.HashedCellOutputMimeType
            );
            expect(mimeTypeTelemetry).to.be.lengthOf(props.length, 'Incorrect number of telemetry messages sent');

            expect(mimeTypeTelemetry).to.deep.equal(
                props.map(prop => [Telemetry.HashedCellOutputMimeType, prop]),
                'Contents in telemetry do not match'
            );
        }

        public sendTelemetryEvent(eventName: string, properties?: {}, _measures?: {}) {
            Reporter.telemetrySent.push([eventName, properties!]);
        }
    }

    setup(async () => {
        fakeTimer = new FakeClock();
        process.env.VSC_PYTHON_UNIT_TEST = undefined;
        process.env.VSC_PYTHON_CI_TEST = undefined;

        openedNotebookEmitter = new EventEmitter<INotebookEditor>();
        nativeProvider = mock(NativeEditorProvider);
        when(nativeProvider.onDidOpenNotebookEditor).thenReturn(openedNotebookEmitter.event);
        when(nativeProvider.editors).thenReturn([]);

        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        outputMimeTypeTracker = new CellOutputMimeTypeTracker(instance(nativeProvider));
        fakeTimer.install();
        await outputMimeTypeTracker.activate();
    });
    teardown(() => {
        fakeTimer.uninstall();
        process.env.VSC_PYTHON_UNIT_TEST = oldValueOfVSC_PYTHON_UNIT_TEST;
        process.env.VSC_PYTHON_CI_TEST = oldValueOfVSC_PYTHON_CI_TEST;
        Reporter.telemetrySent = [];
        rewiremock.disable();
    });

    function emitNotebookEvent(cells: ICell[]) {
        const notebook = mock(NativeEditor);
        const model = mock(NativeEditorStorage);

        when(notebook.file).thenReturn(Uri.file('wow'));
        when(notebook.model).thenReturn(instance(model));
        when(model.cells).thenReturn(cells);

        openedNotebookEmitter.fire(instance(notebook));
    }

    function generateCellWithOutput(outputs: nbformat.IOutput[]): ICell {
        return {
            data: {
                cell_type: 'code',
                source: '',
                execution_count: 1,
                metadata: {},
                outputs
            },
            file: new Date().getTime().toString(),
            id: new Date().getTime().toString(),
            line: 1,
            state: CellState.init
        };
    }
    function generateTextOutput(output_type: string) {
        return { data: { 'text/html': '' }, output_type };
    }
    function generateErrorOutput() {
        return { output_type: 'error' };
    }
    function generateStreamedOutput() {
        return { output_type: 'stream' };
    }
    function generateSvgOutput(output_type: string) {
        return { data: { 'application/svg+xml': '' }, output_type };
    }
    function generatePlotlyOutput(output_type: string) {
        return { data: { 'application/vnd.plotly.v1+json': '' }, output_type };
    }
    function generatePlotlyWithTextOutput(output_type: string) {
        return { data: { 'application/vnd.plotly.v1+json': '', 'text/html': '' }, output_type };
    }
    function generateTelemetry(mimeType: string) {
        const hashedName = sha256()
            .update(mimeType)
            .digest('hex');

        const lowerMimeType = mimeType.toLowerCase();
        return {
            hashedName,
            hasText: lowerMimeType.includes('text').toString(),
            hasLatex: lowerMimeType.includes('latex').toString(),
            hasHtml: lowerMimeType.includes('html').toString(),
            hasSvg: lowerMimeType.includes('svg').toString(),
            hasXml: lowerMimeType.includes('xml').toString(),
            hasJson: lowerMimeType.includes('json').toString(),
            hasImage: lowerMimeType.includes('image').toString(),
            hasGeo: lowerMimeType.includes('geo').toString(),
            hasPlotly: lowerMimeType.includes('plotly').toString(),
            hasVega: lowerMimeType.includes('vega').toString(),
            hasWidget: lowerMimeType.includes('widget').toString(),
            hasJupyter: lowerMimeType.includes('jupyter').toString(),
            hasVnd: lowerMimeType.includes('vnd').toString()
        };
    }
    test('Send telemetry for cell with streamed output', async () => {
        const expectedTelemetry = generateTelemetry('stream');
        const cellTextOutput = generateCellWithOutput([generateStreamedOutput()]);

        emitNotebookEvent([cellTextOutput]);

        await fakeTimer.wait();
        Reporter.expectHashes([expectedTelemetry]);
    });
    test('Send telemetry even if output type is unknown', async () => {
        const expectedTelemetry = generateTelemetry('unrecognized_cell_output');
        const cellTextOutput = generateCellWithOutput([generateTextOutput('unknown_output_type')]);

        emitNotebookEvent([cellTextOutput]);

        await fakeTimer.wait();
        Reporter.expectHashes([expectedTelemetry]);
    });
    test('Send telemetry if output type is markdown', async () => {
        const expectedTelemetry = generateTelemetry('markdown');
        const cellTextOutput = generateCellWithOutput([generateStreamedOutput()]);
        cellTextOutput.data.cell_type = 'markdown';

        emitNotebookEvent([cellTextOutput]);

        await fakeTimer.wait();
        Reporter.expectHashes([expectedTelemetry]);
    });
    suite('No telemetry sent', () => {
        test('If cell has error output', async () => {
            const cellTextOutput = generateCellWithOutput([generateErrorOutput()]);

            emitNotebookEvent([cellTextOutput]);

            await fakeTimer.wait();
            Reporter.expectHashes([]);
        });
        test('If cell type is not code', async () => {
            const cellTextOutput = generateCellWithOutput([generateStreamedOutput()]);
            cellTextOutput.data.cell_type = 'messages';

            emitNotebookEvent([cellTextOutput]);

            await fakeTimer.wait();
            Reporter.expectHashes([]);
        });
        test('If there is no output', async () => {
            const cellTextOutput = generateCellWithOutput([]);

            emitNotebookEvent([cellTextOutput]);

            await fakeTimer.wait();
            Reporter.expectHashes([]);
        });
        [CellState.editing, CellState.error, CellState.executing].forEach(cellState => {
            const cellStateValues = getNamesAndValues(CellState);
            test(`If cell state is '${cellStateValues.find(item => item.value === cellState)?.name}'`, async () => {
                const cellTextOutput = generateCellWithOutput([generateStreamedOutput()]);
                cellTextOutput.state = cellState;

                emitNotebookEvent([cellTextOutput]);

                await fakeTimer.wait();
                Reporter.expectHashes([]);
            });
        });
    });
    test('Send telemetry once for multiple cells with multiple outputs', async () => {
        // Even if we have 2,3 cells, each with multiple text output, send telemetry once for each mime type.
        const expectedTelemetry = [
            generateTelemetry('text/html'),
            generateTelemetry('application/svg+xml'),
            generateTelemetry('application/vnd.plotly.v1+json'),
            generateTelemetry('stream')
        ];
        const cell1 = generateCellWithOutput([
            generateTextOutput('display_data'),
            generateSvgOutput('update_display_data'),
            generatePlotlyWithTextOutput('execute_result')
        ]);
        const cell2 = generateCellWithOutput([generateErrorOutput()]);
        const cell3 = generateCellWithOutput([]);
        const cell4 = generateCellWithOutput([generateStreamedOutput()]);

        emitNotebookEvent([cell1, cell2, cell3, cell4]);

        await fakeTimer.wait();
        Reporter.expectHashes(expectedTelemetry);
    });
    ['display_data', 'update_display_data', 'execute_result'].forEach(outputType => {
        suite(`Send Telemetry for Output Type = ${outputType}`, () => {
            test('MimeType text/html', async () => {
                const expectedTelemetry = generateTelemetry('text/html');
                const cellTextOutput = generateCellWithOutput([generateTextOutput(outputType)]);

                emitNotebookEvent([cellTextOutput]);

                await fakeTimer.wait();
                Reporter.expectHashes([expectedTelemetry]);
            });
            test('MimeType plotly', async () => {
                const expectedTelemetry = generateTelemetry('application/vnd.plotly.v1+json');
                const cellTextOutput = generateCellWithOutput([generatePlotlyOutput(outputType)]);

                emitNotebookEvent([cellTextOutput]);

                await fakeTimer.wait();
                Reporter.expectHashes([expectedTelemetry]);
            });
            test('Multiple mime types', async () => {
                const expectedTelemetry = generateTelemetry('application/vnd.plotly.v1+json');
                const expectedPlainTextTelemetry = generateTelemetry('text/html');
                const cellTextOutput = generateCellWithOutput([generatePlotlyWithTextOutput(outputType)]);

                emitNotebookEvent([cellTextOutput]);

                await fakeTimer.wait();
                Reporter.expectHashes([expectedTelemetry, expectedPlainTextTelemetry]);
            });
            test('Multiple cells and multiple text/html', async () => {
                // Even if we have 2,3 cells, each with multiple text output, send telemetry once for each mime type.
                const expectedTelemetry = generateTelemetry('text/html');
                const cellTextOutput = generateCellWithOutput([
                    generateTextOutput(outputType),
                    generateTextOutput(outputType)
                ]);

                emitNotebookEvent([cellTextOutput, cellTextOutput]);

                await fakeTimer.wait();
                Reporter.expectHashes([expectedTelemetry]);
            });
        });
    });
});
