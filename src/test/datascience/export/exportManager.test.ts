// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { ExportFileOpener } from '../../../client/datascience/export/exportFileOpener';
import { ExportInterpreterFinder } from '../../../client/datascience/export/exportInterpreterFinder';
import { ExportManager } from '../../../client/datascience/export/exportManager';
import { ExportUtil } from '../../../client/datascience/export/exportUtil';
import { ExportFormat, IExport, IExportManagerFilePicker } from '../../../client/datascience/export/types';
import { ProgressReporter } from '../../../client/datascience/progress/progressReporter';
import { IDataScienceFileSystem, INotebookModel } from '../../../client/datascience/types';

suite('DataScience - Export Manager', () => {
    let exporter: ExportManager;
    let exportPython: IExport;
    let exportHtml: IExport;
    let exportPdf: IExport;
    let fileSystem: IDataScienceFileSystem;
    let exportUtil: ExportUtil;
    let filePicker: IExportManagerFilePicker;
    let appShell: IApplicationShell;
    let exportFileOpener: ExportFileOpener;
    let exportInterpreterFinder: ExportInterpreterFinder;
    const model = mock<INotebookModel>();
    setup(async () => {
        exportUtil = mock<ExportUtil>();
        const reporter = mock(ProgressReporter);
        filePicker = mock<IExportManagerFilePicker>();
        fileSystem = mock<IDataScienceFileSystem>();
        exportPython = mock<IExport>();
        exportHtml = mock<IExport>();
        exportPdf = mock<IExport>();
        appShell = mock<IApplicationShell>();
        exportFileOpener = mock<ExportFileOpener>();
        exportInterpreterFinder = mock<ExportInterpreterFinder>();
        // tslint:disable-next-line: no-any
        when(filePicker.getExportFileLocation(anything(), anything(), anything())).thenReturn(
            Promise.resolve(Uri.file('test.pdf'))
        );
        // tslint:disable-next-line: no-empty
        when(appShell.showErrorMessage(anything())).thenResolve();
        // tslint:disable-next-line: no-empty
        when(exportUtil.generateTempDir()).thenResolve({ path: 'test', dispose: () => {} });
        when(exportUtil.makeFileInDirectory(anything(), anything(), anything())).thenResolve('foo');
        // tslint:disable-next-line: no-empty
        when(fileSystem.createTemporaryLocalFile(anything())).thenResolve({ filePath: 'test', dispose: () => {} });
        when(exportPdf.export(anything(), anything(), anything(), anything())).thenResolve();
        when(filePicker.getExportFileLocation(anything(), anything())).thenResolve(Uri.file('foo'));
        when(exportInterpreterFinder.getExportInterpreter(anything())).thenResolve();
        when(exportFileOpener.openFile(anything(), anything())).thenResolve();
        // tslint:disable-next-line: no-any
        when(reporter.createProgressIndicator(anything(), anything())).thenReturn(instance(mock<IDisposable>()) as any);
        exporter = new ExportManager(
            instance(exportPdf),
            instance(exportHtml),
            instance(exportPython),
            instance(fileSystem),
            instance(filePicker),
            instance(reporter),
            instance(exportUtil),
            instance(appShell),
            instance(exportFileOpener),
            instance(exportInterpreterFinder)
        );
    });

    test('Remove svg is called when exporting to PDF', async () => {
        await exporter.export(ExportFormat.pdf, model);
        verify(exportUtil.removeSvgs(anything())).once();
    });
    test('Erorr message is shown if export fails', async () => {
        when(exportHtml.export(anything(), anything(), anything(), anything())).thenThrow(new Error('failed...'));
        await exporter.export(ExportFormat.html, model);
        verify(appShell.showErrorMessage(anything())).once();
        verify(exportFileOpener.openFile(anything(), anything())).never();
    });
    test('Export to PDF is called when export method is PDF', async () => {
        await exporter.export(ExportFormat.pdf, model);
        verify(exportPdf.export(anything(), anything(), anything(), anything())).once();
        verify(exportFileOpener.openFile(ExportFormat.pdf, anything())).once();
    });
    test('Export to HTML is called when export method is HTML', async () => {
        await exporter.export(ExportFormat.html, model);
        verify(exportHtml.export(anything(), anything(), anything(), anything())).once();
        verify(exportFileOpener.openFile(ExportFormat.html, anything())).once();
    });
    test('Export to Python is called when export method is Python', async () => {
        await exporter.export(ExportFormat.python, model);
        verify(exportPython.export(anything(), anything(), anything(), anything())).once();
        verify(exportFileOpener.openFile(ExportFormat.python, anything())).once();
    });
});
