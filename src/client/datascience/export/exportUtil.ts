import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { CancellationTokenSource, Uri } from 'vscode';
import { IFileSystem, TemporaryDirectory } from '../../common/platform/types';
import { sleep } from '../../common/utils/async';
import { ICell, INotebookExporter, INotebookModel, INotebookStorage } from '../types';

@injectable()
export class ExportUtil {
    constructor(
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(INotebookStorage) private notebookStorage: INotebookStorage,
        @inject(INotebookExporter) private jupyterExporter: INotebookExporter
    ) {}

    public async generateTempDir(): Promise<TemporaryDirectory> {
        const resultDir = path.join(os.tmpdir(), uuid());
        await this.fileSystem.createDirectory(resultDir);

        return {
            path: resultDir,
            dispose: async () => {
                // Try ten times. Process may still be up and running.
                // We don't want to do async as async dispose means it may never finish and then we don't
                // delete
                let count = 0;
                while (count < 10) {
                    try {
                        await this.fileSystem.deleteDirectory(resultDir);
                        count = 10;
                    } catch {
                        await sleep(3000);
                        count += 1;
                    }
                }
            }
        };
    }

    public async makeFileInDirectory(model: INotebookModel, fileName: string, dirPath: string): Promise<string> {
        const newFilePath = path.join(dirPath, fileName);

        await this.fileSystem.writeFile(newFilePath, model.getContent(), 'utf-8');

        return newFilePath;
    }

    public async getModelFromCells(cells: ICell[]): Promise<INotebookModel> {
        const tempDir = await this.generateTempDir();
        const tempFile = await this.fileSystem.createTemporaryFile('.ipynb');
        let model: INotebookModel;

        try {
            await this.jupyterExporter.exportToFile(cells, tempFile.filePath, false);
            const newPath = path.join(tempDir.path, '.ipynb');
            await this.fileSystem.copyFile(tempFile.filePath, newPath);
            model = await this.notebookStorage.load(Uri.file(newPath));
        } finally {
            tempFile.dispose();
            tempDir.dispose();
        }

        return model;
    }

    public async removeSvgs(source: Uri) {
        const model = await this.notebookStorage.load(source);

        const newCells: ICell[] = [];
        for (const cell of model.cells) {
            const outputs = cell.data.outputs;
            if (outputs as nbformat.IOutput[]) {
                this.removeSvgFromOutputs(outputs as nbformat.IOutput[]);
            }
            newCells.push(cell);
        }
        model.update({
            kind: 'modify',
            newCells: newCells,
            oldCells: model.cells as ICell[],
            oldDirty: false,
            newDirty: false,
            source: 'user'
        });
        await this.notebookStorage.save(model, new CancellationTokenSource().token);
    }

    private removeSvgFromOutputs(outputs: nbformat.IOutput[]) {
        const SVG = 'image/svg+xml';
        const PNG = 'image/png';
        for (const output of outputs as nbformat.IOutput[]) {
            if (output.data as nbformat.IMimeBundle) {
                const data = output.data as nbformat.IMimeBundle;
                // only remove the svg if there is a png available
                if (!(SVG in data)) {
                    continue;
                }
                if (PNG in data) {
                    delete data[SVG];
                }
            }
        }
    }
}
