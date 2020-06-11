// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IDocumentManager } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { ExportFormat, IExportManager } from '../../../client/datascience/export/exportManager';
import { ExportManagerFileOpener } from '../../../client/datascience/export/exportManagerFileOpener';
import { ProgressReporter } from '../../../client/datascience/progress/progressReporter';
import { INotebookModel } from '../../../client/datascience/types';

suite('Data Science - Export File Opener', () => {
    let fileOpener: ExportManagerFileOpener;
    let exporter: IExportManager;
    let documentManager: IDocumentManager;
    const model = instance(mock<INotebookModel>());
    setup(async () => {
        exporter = mock<IExportManager>();
        documentManager = mock<IDocumentManager>();
        const reporter = mock(ProgressReporter);
        // tslint:disable-next-line: no-any
        when(reporter.createProgressIndicator(anything())).thenReturn(instance(mock<IDisposable>()) as any);
        when(documentManager.openTextDocument(anything())).thenResolve();
        when(documentManager.showTextDocument(anything())).thenResolve();
        fileOpener = new ExportManagerFileOpener(instance(exporter), instance(documentManager), instance(reporter));
    });

    test('No file is opened if nothing is exported', async () => {
        when(exporter.export(anything(), anything())).thenResolve();

        await fileOpener.export(ExportFormat.python, model);

        verify(documentManager.showTextDocument(anything())).never();
    });
    test('File is opened if exported', async () => {
        const uri = Uri.file('blah.python');
        when(exporter.export(anything(), anything())).thenResolve(uri);

        await fileOpener.export(ExportFormat.python, model);

        verify(documentManager.showTextDocument(anything())).once();
    });
});
