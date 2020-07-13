// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../../client/common/application/types';
import { IFileSystem, TemporaryFile } from '../../../client/common/platform/types';
import { IDisposable } from '../../../client/common/types';
import { ExportDependencyChecker } from '../../../client/datascience/export/exportDependencyChecker';
import { ExportFileOpener } from '../../../client/datascience/export/exportFileOpener';
import { ExportManager } from '../../../client/datascience/export/exportManager';
import { ExportUtil } from '../../../client/datascience/export/exportUtil';
import { ExportFormat, IExport, IExportManagerFilePicker } from '../../../client/datascience/export/types';
import { ProgressReporter } from '../../../client/datascience/progress/progressReporter';
import { INotebookModel } from '../../../client/datascience/types';

suite('Data Science - Export Manager', () => {
    let exporter: ExportManager;
    let exportPython: IExport;
    let exportHtml: IExport;
    let exportPdf: IExport;
    let fileSystem: IFileSystem;
    let exportUtil: ExportUtil;
    let filePicker: IExportManagerFilePicker;
    let tempFile: TemporaryFile;
    let appShell: IApplicationShell;
    let exportFileOpener: ExportFileOpener;
    let exportDependencyChecker: ExportDependencyChecker;
    const model = mock<INotebookModel>();
    setup(async () => {
        exportUtil = mock<ExportUtil>();
        const reporter = mock(ProgressReporter);
        filePicker = mock<IExportManagerFilePicker>();
        fileSystem = mock<IFileSystem>();
        exportPython = mock<IExport>();
        exportHtml = mock<IExport>();
        exportPdf = mock<IExport>();
        tempFile = mock<TemporaryFile>();
        appShell = mock<IApplicationShell>();
        exportFileOpener = mock<ExportFileOpener>();
        exportDependencyChecker = mock<ExportDependencyChecker>();

        // tslint:disable-next-line: no-any
        when(filePicker.getExportFileLocation(anything(), anything(), anything())).thenReturn(
            Promise.resolve(Uri.file('test.pdf'))
        );
        // tslint:disable-next-line: no-empty
        when(exportUtil.generateTempDir()).thenResolve({ path: 'test', dispose: () => {} });
        when(exportUtil.makeFileInDirectory(anything(), anything(), anything())).thenResolve('foo');
        when(fileSystem.createTemporaryFile(anything())).thenResolve(instance(tempFile));
        when(exportPdf.export(anything(), anything(), anything())).thenResolve();
        when(filePicker.getExportFileLocation(anything(), anything())).thenResolve(Uri.file('foo'));
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
            instance(exportDependencyChecker)
        );
    });

    test('Remove svg is called when exporting to PDF', async () => {
        await exporter.export(ExportFormat.pdf, model);
        verify(exportUtil.removeSvgs(anything())).once();
    });
});
