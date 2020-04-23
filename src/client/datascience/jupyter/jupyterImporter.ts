// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import type { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import * as path from 'path';

import { IWorkspaceService } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { CodeSnippits, Identifiers } from '../constants';
import { CellState, ICell, IJupyterExecution, INotebookImporter } from '../types';
import { InvalidNotebookFileError } from './invalidNotebookFileError';

@injectable()
export class JupyterImporter implements INotebookImporter {
    public isDisposed: boolean = false;
    // Template that changes markdown cells to have # %% [markdown] in the comments
    private readonly nbconvertTemplateFormat =
        // tslint:disable-next-line:no-multiline-string
        `{%- extends 'null.tpl' -%}
{% block codecell %}
{0}
{{ super() }}
{% endblock codecell %}
{% block in_prompt %}{% endblock in_prompt %}
{% block input %}{{ cell.source | ipython2python }}{% endblock input %}
{% block markdowncell scoped %}{0} [markdown]
{{ cell.source | comment_lines }}
{% endblock markdowncell %}`;

    private templatePromise: Promise<string | undefined>;

    constructor(
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IPlatformService) private readonly platform: IPlatformService
    ) {
        this.templatePromise = this.createTemplateFile();
    }

    public async importFromFile(contentsFile: string, originalFile?: string): Promise<string> {
        const template = await this.templatePromise;

        // If the user has requested it, add a cd command to the imported file so that relative paths still work
        const settings = this.configuration.getSettings();
        let directoryChange: string | undefined;
        if (settings.datascience.changeDirOnImportExport) {
            // If an original file is passed in, then use that for calculating the directory change as contents might be an invalid location
            directoryChange = await this.calculateDirectoryChange(originalFile ? originalFile : contentsFile);
        }

        // Use the jupyter nbconvert functionality to turn the notebook into a python file
        if (await this.jupyterExecution.isImportSupported()) {
            let fileOutput: string = await this.jupyterExecution.importNotebook(contentsFile, template);
            if (fileOutput.includes('get_ipython()')) {
                fileOutput = this.addIPythonImport(fileOutput);
            }
            if (directoryChange) {
                fileOutput = this.addDirectoryChange(fileOutput, directoryChange);
            }
            return this.addInstructionComments(fileOutput);
        }

        throw new Error(localize.DataScience.jupyterNbConvertNotSupported());
    }

    public async importCellsFromFile(file: string): Promise<ICell[]> {
        // First convert to a python file to verify this file is valid. This is
        // an easy way to have something else verify the validity of the file. If nbconvert isn't installed
        // just assume the file is correct.
        const results = (await this.jupyterExecution.isImportSupported()) ? await this.importFromFile(file) : '';
        if (results) {
            // Then read in the file as json. This json should already
            return this.importCells(await this.fileSystem.readFile(file));
        }

        throw new InvalidNotebookFileError(file);
    }

    public async importCells(json: string): Promise<ICell[]> {
        // Should we do validation here? jupyterlabs has a ContentsManager that can do validation, but skipping
        // for now because:
        // a) JSON parse should validate that it's JSON
        // b) cells check should validate it's at least close to a notebook
        // tslint:disable-next-line: no-any
        const contents = json ? (JSON.parse(json) as any) : undefined;
        if (contents && contents.cells) {
            // Convert the cells into actual cell objects
            const cells = contents.cells as (nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell)[];

            // Convert the inputdata into our ICell format
            return cells.map((c, index) => {
                return {
                    id: `NotebookImport#${index}`,
                    file: Identifiers.EmptyFileName,
                    line: 0,
                    state: CellState.finished,
                    data: c,
                    type: 'preview'
                };
            });
        }

        throw new InvalidNotebookFileError();
    }

    public dispose = () => {
        this.isDisposed = true;
    };

    private addInstructionComments = (pythonOutput: string): string => {
        const comments = localize.DataScience.instructionComments().format(this.defaultCellMarker);
        return comments.concat(pythonOutput);
    };

    private get defaultCellMarker(): string {
        return this.configuration.getSettings().datascience.defaultCellMarker || Identifiers.DefaultCodeCellMarker;
    }

    private addIPythonImport = (pythonOutput: string): string => {
        return CodeSnippits.ImportIPython.format(this.defaultCellMarker, pythonOutput);
    };

    private addDirectoryChange = (pythonOutput: string, directoryChange: string): string => {
        const newCode = CodeSnippits.ChangeDirectory.join(os.EOL).format(
            localize.DataScience.importChangeDirectoryComment().format(this.defaultCellMarker),
            CodeSnippits.ChangeDirectoryCommentIdentifier,
            directoryChange
        );
        return newCode.concat(pythonOutput);
    };

    // When importing a file, calculate if we can create a %cd so that the relative paths work
    private async calculateDirectoryChange(notebookFile: string): Promise<string | undefined> {
        let directoryChange: string | undefined;
        try {
            // Make sure we don't already have an import/export comment in the file
            const contents = await this.fileSystem.readFile(notebookFile);
            const haveChangeAlready = contents.includes(CodeSnippits.ChangeDirectoryCommentIdentifier);

            if (!haveChangeAlready) {
                const notebookFilePath = path.dirname(notebookFile);
                // First see if we have a workspace open, this only works if we have a workspace root to be relative to
                if (this.workspaceService.hasWorkspaceFolders) {
                    const workspacePath = this.workspaceService.workspaceFolders![0].uri.fsPath;

                    // Make sure that we have everything that we need here
                    if (
                        workspacePath &&
                        path.isAbsolute(workspacePath) &&
                        notebookFilePath &&
                        path.isAbsolute(notebookFilePath)
                    ) {
                        directoryChange = path.relative(workspacePath, notebookFilePath);
                    }
                }
            }

            // If path.relative can't calculate a relative path, then it just returns the full second path
            // so check here, we only want this if we were able to calculate a relative path, no network shares or drives
            if (directoryChange && !path.isAbsolute(directoryChange)) {
                // Escape windows path chars so they end up in the source escaped
                if (this.platform.isWindows) {
                    directoryChange = directoryChange.replace('\\', '\\\\');
                }

                return directoryChange;
            } else {
                return undefined;
            }
        } catch (e) {
            traceError(e);
        }
    }

    private async createTemplateFile(): Promise<string | undefined> {
        // Create a temp file on disk
        const file = await this.fileSystem.createTemporaryFile('.tpl');

        // Write our template into it
        if (file) {
            try {
                // Save this file into our disposables so the temp file goes away
                this.disposableRegistry.push(file);
                await this.fileSystem.appendFile(
                    file.filePath,
                    this.nbconvertTemplateFormat.format(this.defaultCellMarker)
                );

                // Now we should have a template that will convert
                return file.filePath;
            } catch {
                noop();
            }
        }
    }
}
