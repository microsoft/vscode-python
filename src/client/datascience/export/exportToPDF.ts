import { inject, injectable, named } from 'inversify';
import * as puppeteer from 'puppeteer';
import { Uri } from 'vscode';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { IDataScienceErrorHandler, IJupyterSubCommandExecutionService, INotebookImporter } from '../types';
import { ExportBase } from './exportBase';
import { ExportFormat, IExport } from './types';

@injectable()
export class ExportToPDF extends ExportBase {
    constructor(
        @inject(IPythonExecutionFactory) protected readonly pythonExecutionFactory: IPythonExecutionFactory,
        @inject(IJupyterSubCommandExecutionService)
        protected jupyterService: IJupyterSubCommandExecutionService,
        @inject(IFileSystem) protected readonly fileSystem: IFileSystem,
        @inject(INotebookImporter) protected readonly importer: INotebookImporter,
        @inject(IExport) @named(ExportFormat.html) private readonly exportToHTML: IExport,
        @inject(IDataScienceErrorHandler) private readonly errorHandler: IDataScienceErrorHandler
    ) {
        super(pythonExecutionFactory, jupyterService, fileSystem, importer);
    }

    public async export(source: Uri, target: Uri): Promise<void> {
        const tempFile = await this.makeTempFile();
        if (!tempFile) {
            return;
        }
        try {
            await this.exportToHTML.export(source, Uri.file(tempFile.filePath));
            const pdfContents = await this.printPDF(tempFile.filePath);
            await this.fileSystem.writeFile(target.fsPath, pdfContents);
        } finally {
            tempFile.dispose();
        }
    }

    @reportAction(ReportableAction.ConvertingToPDF)
    private async printPDF(file: string) {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(file, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4' });
        await browser.close();

        return pdf;
    }

    private async makeTempFile(): Promise<TemporaryFile | undefined> {
        let tempFile;
        try {
            tempFile = await this.fileSystem.createTemporaryFile('.html');
        } catch (e) {
            await this.errorHandler.handleError(e);
        }
        return tempFile;
    }
}
