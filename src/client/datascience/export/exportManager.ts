import { inject, injectable, named } from 'inversify';
import { Memento, SaveDialogOptions, Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { ExportNotebookSettings } from '../interactive-common/interactiveWindowTypes';
import { IDataScienceErrorHandler, INotebookEditor } from '../types';

export enum ExportFormat {
    pdf = 'pdf',
    html = 'html',
    python = 'python'
}

export const PDFExtensions = { PDF: ['.pdf'] };
export const HTMLExtensions = { HTML: ['.html', 'htm'] };
export const PythonExtensions = { Python: ['.py'] };

export const IExportManager = Symbol('IExportManager');
export interface IExportManager {
    export(format: ExportFormat, activeEditor: INotebookEditor): Promise<Uri | undefined>;
}

export const IExport = Symbol('IExport');
export interface IExport {
    export(source: Uri, target?: Uri): Promise<void>;
}

@injectable()
export class ExportManager implements IExportManager {
    private readonly defaultExportSaveLocation = ''; // set default save location

    constructor(
        @inject(IExport) @named(ExportFormat.pdf) private readonly exportToPDF: IExport,
        @inject(IExport) @named(ExportFormat.html) private readonly exportToHTML: IExport,
        @inject(IExport) @named(ExportFormat.python) private readonly exportToPython: IExport,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private workspaceStorage: Memento,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IDataScienceErrorHandler) private readonly errorHandler: IDataScienceErrorHandler
    ) {}

    public async export(format: ExportFormat, activeEditor: INotebookEditor): Promise<Uri | undefined> {
        // need to add telementry and status messages

        let target;
        if (format !== ExportFormat.python) {
            target = await this.getExportFileLocation(format);
            if (!target) {
                return; // user didn't select path
            }
        }

        const tempFile = await this.makeTemporaryFile(activeEditor);
        if (!tempFile) {
            return; // error making temp file
        }

        try {
            const source = Uri.file(tempFile.filePath);

            switch (format) {
                case ExportFormat.python:
                    await this.exportToPython.export(source, target);
                    break;

                case ExportFormat.pdf:
                    await this.exportToPDF.export(source, target);
                    break;

                case ExportFormat.html:
                    await this.exportToHTML.export(source, target);
                    break;
                default:
                    break;
            }
        } finally {
            tempFile.dispose(); // need to dispose of temp file
        }
    }

    private async makeTemporaryFile(activeEditor: INotebookEditor): Promise<TemporaryFile | undefined> {
        let tempFile: TemporaryFile | undefined;
        try {
            tempFile = await this.fileSystem.createTemporaryFile('.ipynb');
            const content = activeEditor?.model ? activeEditor.model.getContent() : '';
            await this.fileSystem.writeFile(tempFile.filePath, content, 'utf-8');
        } catch (e) {
            await this.errorHandler.handleError(e);
        }

        return tempFile;
    }

    private getFileSaveLocation(): Uri {
        const filePath = this.workspaceStorage.get(
            ExportNotebookSettings.lastSaveLocation,
            this.defaultExportSaveLocation
        );

        return Uri.file(filePath);
    }

    private updateFileSaveLocation(value: Uri) {
        const filePath = value.toString();
        this.workspaceStorage.update(ExportNotebookSettings.lastSaveLocation, filePath);
    }

    private async getExportFileLocation(format: ExportFormat): Promise<Uri | undefined> {
        let fileExtensions;
        switch (format) {
            case ExportFormat.python:
                fileExtensions = PythonExtensions;
                break;

            case ExportFormat.pdf:
                fileExtensions = PDFExtensions;
                break;

            case ExportFormat.html:
                fileExtensions = HTMLExtensions;
                break;

            default:
                return;
        }

        const options: SaveDialogOptions = {
            defaultUri: this.getFileSaveLocation(),
            saveLabel: '',
            filters: fileExtensions
        };

        const uri = await this.applicationShell.showSaveDialog(options);
        if (uri) {
            this.updateFileSaveLocation(uri);
        }
        return uri;
    }
}

@injectable()
export class ExportManagerDependencyChecker implements IExportManager {
    constructor(@inject(ExportManager) private readonly manager: IExportManager) {}

    public async export(format: ExportFormat, activeEditor: INotebookEditor): Promise<Uri | undefined> {
        // CHekc dependnecies.. etc.

        // if not ok return.
        // Else export.
        return this.manager.export(format, activeEditor);
    }
}

@injectable()
export class ExportManagerFileOpener implements IExportManager {
    constructor(@inject(ExportManagerDependencyChecker) private readonly manager: IExportManager) {}

    public async export(format: ExportFormat, activeEditor: INotebookEditor): Promise<Uri | undefined> {
        const uri = await this.manager.export(format, activeEditor);

        // open the file.
        return uri;
    }
}
// make new command registry, move stuff from old
// continue with decorater pattern - READ
// ts mockito - READ
// do depenedncy checking using code seen before
// test that stuff
