// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { TextEditor, Uri } from 'vscode';
import { IApplicationShell, IDocumentManager } from '../../../client/common/application/types';
import { IBrowserService, IDisposable } from '../../../client/common/types';
import { ExportFileOpener } from '../../../client/datascience/export/exportFileOpener';
import { ExportFormat } from '../../../client/datascience/export/types';
import { ProgressReporter } from '../../../client/datascience/progress/progressReporter';
import { IDataScienceFileSystem } from '../../../client/datascience/types';
import { getLocString } from '../../../datascience-ui/react-common/locReactSide';

suite('DataScience - Export File Opener', () => {
    let fileOpener: ExportFileOpener;
    let documentManager: IDocumentManager;
    let fileSystem: IDataScienceFileSystem;
    let applicationShell: IApplicationShell;
    let browserService: IBrowserService;
    setup(async () => {
        documentManager = mock<IDocumentManager>();
        fileSystem = mock<IDataScienceFileSystem>();
        applicationShell = mock<IApplicationShell>();
        browserService = mock<IBrowserService>();
        const reporter = mock(ProgressReporter);
        const editor = mock<TextEditor>();
        // tslint:disable-next-line: no-any
        (instance(editor) as any).then = undefined;
        // tslint:disable-next-line: no-any
        when(reporter.createProgressIndicator(anything())).thenReturn(instance(mock<IDisposable>()) as any);
        when(documentManager.openTextDocument(anything())).thenResolve();
        when(documentManager.showTextDocument(anything())).thenReturn(Promise.resolve(instance(editor)));
        when(fileSystem.readFile(anything())).thenResolve();
        fileOpener = new ExportFileOpener(
            instance(documentManager),
            instance(fileSystem),
            instance(applicationShell),
            instance(browserService)
        );
    });

    test('Python File is opened if exported', async () => {
        const uri = Uri.file('test.python');
        await fileOpener.openFile(ExportFormat.python, uri);

        verify(documentManager.showTextDocument(anything())).once();
    });
    test('HTML File opened if yes button pressed', async () => {
        const uri = Uri.file('test.html');
        when(applicationShell.showInformationMessage(anything(), anything(), anything())).thenReturn(
            Promise.resolve(getLocString('DataScience.openExportFileYes', 'Yes'))
        );

        await fileOpener.openFile(ExportFormat.html, uri);

        verify(browserService.launch(anything())).once();
    });
    test('HTML File not opened if no button button pressed', async () => {
        const uri = Uri.file('test.html');
        when(applicationShell.showInformationMessage(anything(), anything(), anything())).thenReturn(
            Promise.resolve(getLocString('DataScience.openExportFileNo', 'No'))
        );

        await fileOpener.openFile(ExportFormat.html, uri);

        verify(browserService.launch(anything())).never();
    });
    test('PDF File opened if yes button pressed', async () => {
        const uri = Uri.file('test.pdf');
        when(applicationShell.showInformationMessage(anything(), anything(), anything())).thenReturn(
            Promise.resolve(getLocString('DataScience.openExportFileYes', 'Yes'))
        );

        await fileOpener.openFile(ExportFormat.pdf, uri);

        verify(browserService.launch(anything())).once();
    });
    test('PDF File not opened if no button button pressed', async () => {
        const uri = Uri.file('test.pdf');
        when(applicationShell.showInformationMessage(anything(), anything(), anything())).thenReturn(
            Promise.resolve(getLocString('DataScience.openExportFileNo', 'No'))
        );

        await fileOpener.openFile(ExportFormat.pdf, uri);

        verify(browserService.launch(anything())).never();
    });
});
