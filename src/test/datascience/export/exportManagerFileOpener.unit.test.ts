// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IApplicationShell, IDocumentManager } from '../../../client/common/application/types';
import { IFileSystem } from '../../../client/common/platform/types';
import { IBrowserService, IDisposable } from '../../../client/common/types';
import { ExportManagerFileOpener } from '../../../client/datascience/export/exportManagerFileOpener';
import { ExportFormat, IExportManager } from '../../../client/datascience/export/types';
import { ProgressReporter } from '../../../client/datascience/progress/progressReporter';
import { INotebookModel } from '../../../client/datascience/types';
import { getLocString } from '../../../datascience-ui/react-common/locReactSide';

suite('Data Science - Export File Opener', () => {
    let fileOpener: ExportManagerFileOpener;
    let exporter: IExportManager;
    let documentManager: IDocumentManager;
    let fileSystem: IFileSystem;
    let applicationShell: IApplicationShell;
    let browserService: IBrowserService;
    const model = instance(mock<INotebookModel>());
    setup(async () => {
        exporter = mock<IExportManager>();
        documentManager = mock<IDocumentManager>();
        fileSystem = mock<IFileSystem>();
        applicationShell = mock<IApplicationShell>();
        browserService = mock<IBrowserService>();
        const reporter = mock(ProgressReporter);
        // tslint:disable-next-line: no-any
        when(reporter.createProgressIndicator(anything())).thenReturn(instance(mock<IDisposable>()) as any);
        when(documentManager.openTextDocument(anything())).thenResolve();
        when(documentManager.showTextDocument(anything())).thenResolve();
        when(fileSystem.readFile(anything())).thenResolve();
        fileOpener = new ExportManagerFileOpener(
            instance(exporter),
            instance(documentManager),
            instance(fileSystem),
            instance(applicationShell),
            instance(browserService)
        );
    });

    test('No file is opened if nothing is exported', async () => {
        when(exporter.export(anything(), anything())).thenResolve();

        await fileOpener.export(ExportFormat.python, model);

        verify(documentManager.showTextDocument(anything())).never();
    });
    test('Python File is opened if exported', async () => {
        const uri = Uri.file('test.python');
        when(exporter.export(anything(), anything())).thenResolve(uri);

        await fileOpener.export(ExportFormat.python, model);

        verify(documentManager.showTextDocument(anything())).once();
    });
    test('HTML File opened if yes button pressed', async () => {
        const uri = Uri.file('test.html');
        when(exporter.export(anything(), anything())).thenResolve(uri);
        when(applicationShell.showInformationMessage(anything(), anything(), anything())).thenReturn(
            Promise.resolve(getLocString('DataScience.openExportFileYes', 'Yes'))
        );

        await fileOpener.export(ExportFormat.html, model);

        verify(browserService.launch(anything())).once();
    });
    test('HTML File not opened if no button button pressed', async () => {
        const uri = Uri.file('test.html');
        when(exporter.export(anything(), anything())).thenResolve(uri);
        when(applicationShell.showInformationMessage(anything(), anything(), anything())).thenReturn(
            Promise.resolve(getLocString('DataScience.openExportFileNo', 'No'))
        );

        await fileOpener.export(ExportFormat.html, model);

        verify(browserService.launch(anything())).never();
    });
    test('Exporting to PDF displays message if operation fails', async () => {
        when(exporter.export(anything(), anything())).thenThrow(new Error('Export failed...'));
        when(applicationShell.showErrorMessage(anything())).thenResolve();
        await fileOpener.export(ExportFormat.pdf, model);
        verify(applicationShell.showErrorMessage(anything())).once();
    });
    test('PDF File opened if yes button pressed', async () => {
        const uri = Uri.file('test.pdf');
        when(exporter.export(anything(), anything())).thenResolve(uri);
        when(applicationShell.showInformationMessage(anything(), anything(), anything())).thenReturn(
            Promise.resolve(getLocString('DataScience.openExportFileYes', 'Yes'))
        );

        await fileOpener.export(ExportFormat.pdf, model);

        verify(browserService.launch(anything())).once();
    });
    test('PDF File not opened if no button button pressed', async () => {
        const uri = Uri.file('test.pdf');
        when(exporter.export(anything(), anything())).thenResolve(uri);
        when(applicationShell.showInformationMessage(anything(), anything(), anything())).thenReturn(
            Promise.resolve(getLocString('DataScience.openExportFileNo', 'No'))
        );

        await fileOpener.export(ExportFormat.pdf, model);

        verify(browserService.launch(anything())).never();
    });
});
