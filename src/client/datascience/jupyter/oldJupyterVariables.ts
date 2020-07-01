// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import stripAnsi from 'strip-ansi';
import * as uuid from 'uuid/v4';

import { Event, EventEmitter, Uri } from 'vscode';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { Identifiers, Settings } from '../constants';
import {
    ICell,
    IJupyterVariable,
    IJupyterVariables,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse,
    INotebook
} from '../types';
import { JupyterDataRateLimitError } from './jupyterDataRateLimitError';

// tslint:disable-next-line: no-var-requires no-require-imports

// Regexes for parsing data from Python kernel. Not sure yet if other
// kernels will add the ansi encoding.
const TypeRegex = /.*?\[.*?;31mType:.*?\[0m\s+(\w+)/;
const ValueRegex = /.*?\[.*?;31mValue:.*?\[0m\s+(.*)/;
const StringFormRegex = /.*?\[.*?;31mString form:.*?\[0m\s*?([\s\S]+?)\n(.*\[.*;31m?)/;
const DocStringRegex = /.*?\[.*?;31mDocstring:.*?\[0m\s+(.*)/;
const CountRegex = /.*?\[.*?;31mLength:.*?\[0m\s+(.*)/;
const ShapeRegex = /^\s+\[(\d+) rows x (\d+) columns\]/m;

const DataViewableTypes: Set<string> = new Set<string>(['DataFrame', 'list', 'dict', 'ndarray', 'Series']);

interface INotebookState {
    currentExecutionCount: number;
    variables: IJupyterVariable[];
}

@injectable()
export class OldJupyterVariables implements IJupyterVariables {
    private fetchDataFrameInfoScript?: string;
    private fetchDataFrameRowsScript?: string;
    private fetchVariableShapeScript?: string;
    private filesLoaded: boolean = false;
    private languageToQueryMap = new Map<string, { query: string; parser: RegExp }>();
    private notebookState = new Map<Uri, INotebookState>();
    private refreshEventEmitter = new EventEmitter<void>();

    constructor(
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IConfigurationService) private configService: IConfigurationService
    ) {}

    public get refreshRequired(): Event<void> {
        return this.refreshEventEmitter.event;
    }

    // IJupyterVariables implementation
    public async getVariables(
        notebook: INotebook,
        request: IJupyterVariablesRequest
    ): Promise<IJupyterVariablesResponse> {
        // Run the language appropriate variable fetch
        return this.getVariablesBasedOnKernel(notebook, request);
    }

    public async getMatchingVariable(_notebook: INotebook, _name: string): Promise<IJupyterVariable | undefined> {
        // Not supported with old method.
        return undefined;
    }

    public async getDataFrameInfo(targetVariable: IJupyterVariable, notebook: INotebook): Promise<IJupyterVariable> {
        // Run the get dataframe info script
        return this.runScript<IJupyterVariable>(
            notebook,
            targetVariable,
            targetVariable,
            () => this.fetchDataFrameInfoScript,
            [{ key: '_VSCode_JupyterValuesColumn', value: localize.DataScience.valuesColumn() }]
        );
    }

    public async getDataFrameRows(
        targetVariable: IJupyterVariable,
        notebook: INotebook,
        start: number,
        end: number
    ): Promise<{}> {
        // Run the get dataframe rows script
        return this.runScript<{}>(notebook, targetVariable, {}, () => this.fetchDataFrameRowsScript, [
            { key: '_VSCode_JupyterValuesColumn', value: localize.DataScience.valuesColumn() },
            { key: '_VSCode_JupyterStartRow', value: start.toString() },
            { key: '_VSCode_JupyterEndRow', value: end.toString() }
        ]);
    }

    // Private methods
    // Load our python files for fetching variables
    private async loadVariableFiles(): Promise<void> {
        let file = path.join(
            EXTENSION_ROOT_DIR,
            'pythonFiles',
            'vscode_datascience_helpers',
            'getJupyterVariableDataFrameInfo.py'
        );
        this.fetchDataFrameInfoScript = await this.fileSystem.readFile(file);

        file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'vscode_datascience_helpers', 'getJupyterVariableShape.py');
        this.fetchVariableShapeScript = await this.fileSystem.readFile(file);

        file = path.join(
            EXTENSION_ROOT_DIR,
            'pythonFiles',
            'vscode_datascience_helpers',
            'getJupyterVariableDataFrameRows.py'
        );
        this.fetchDataFrameRowsScript = await this.fileSystem.readFile(file);

        this.filesLoaded = true;
    }

    private async runScript<T>(
        notebook: INotebook,
        targetVariable: IJupyterVariable | undefined,
        defaultValue: T,
        scriptBaseTextFetcher: () => string | undefined,
        extraReplacements: { key: string; value: string }[] = []
    ): Promise<T> {
        if (!this.filesLoaded) {
            await this.loadVariableFiles();
        }

        const scriptBaseText = scriptBaseTextFetcher();
        if (!notebook || !scriptBaseText) {
            // No active server just return the unchanged target variable
            return defaultValue;
        }

        // Prep our targetVariable to send over. Remove the 'value' as it's not necessary for getting df info and can have invalid data in it
        const pruned = { ...targetVariable, value: '' };
        const variableString = JSON.stringify(pruned);

        // Setup a regex
        const regexPattern =
            extraReplacements.length === 0
                ? '_VSCode_JupyterTestValue'
                : ['_VSCode_JupyterTestValue', ...extraReplacements.map((v) => v.key)].join('|');
        const replaceRegex = new RegExp(regexPattern, 'g');

        // Replace the test value with our current value. Replace start and end as well
        const scriptText = scriptBaseText.replace(replaceRegex, (match: string) => {
            if (match === '_VSCode_JupyterTestValue') {
                return variableString;
            } else {
                const index = extraReplacements.findIndex((v) => v.key === match);
                if (index >= 0) {
                    return extraReplacements[index].value;
                }
            }

            return match;
        });

        // Execute this on the notebook passed in.
        const results = await notebook.execute(scriptText, Identifiers.EmptyFileName, 0, uuid(), undefined, true);

        // Results should be the updated variable.
        return this.deserializeJupyterResult<T>(results);
    }

    private extractJupyterResultText(cells: ICell[]): string {
        // Verify that we have the correct cell type and outputs
        if (cells.length > 0 && cells[0].data) {
            const codeCell = cells[0].data as nbformat.ICodeCell;
            if (codeCell.outputs.length > 0) {
                const codeCellOutput = codeCell.outputs[0] as nbformat.IOutput;
                if (
                    codeCellOutput &&
                    codeCellOutput.output_type === 'stream' &&
                    codeCellOutput.name === 'stderr' &&
                    codeCellOutput.hasOwnProperty('text')
                ) {
                    const resultString = codeCellOutput.text as string;
                    // See if this the IOPUB data rate limit problem
                    if (resultString.includes('iopub_data_rate_limit')) {
                        throw new JupyterDataRateLimitError();
                    } else {
                        const error = localize.DataScience.jupyterGetVariablesExecutionError().format(resultString);
                        traceError(error);
                        throw new Error(error);
                    }
                }
                if (codeCellOutput && codeCellOutput.output_type === 'execute_result') {
                    const data = codeCellOutput.data;
                    if (data && data.hasOwnProperty('text/plain')) {
                        // tslint:disable-next-line:no-any
                        return (data as any)['text/plain'];
                    }
                }
                if (
                    codeCellOutput &&
                    codeCellOutput.output_type === 'stream' &&
                    codeCellOutput.hasOwnProperty('text')
                ) {
                    return codeCellOutput.text as string;
                }
                if (
                    codeCellOutput &&
                    codeCellOutput.output_type === 'error' &&
                    codeCellOutput.hasOwnProperty('traceback')
                ) {
                    const traceback: string[] = codeCellOutput.traceback as string[];
                    const stripped = traceback.map(stripAnsi).join('\r\n');
                    const error = localize.DataScience.jupyterGetVariablesExecutionError().format(stripped);
                    traceError(error);
                    throw new Error(error);
                }
            }
        }

        throw new Error(localize.DataScience.jupyterGetVariablesBadResults());
    }

    // Pull our text result out of the Jupyter cell
    private deserializeJupyterResult<T>(cells: ICell[]): T {
        const text = this.extractJupyterResultText(cells);
        return JSON.parse(text) as T;
    }

    private getParser(notebook: INotebook) {
        // Figure out kernel language
        let language = PYTHON_LANGUAGE;
        if (notebook) {
            const kernel = notebook.getKernelSpec();
            language = kernel && kernel.language ? kernel.language : PYTHON_LANGUAGE;
        }

        // We may have cached this information
        let result = this.languageToQueryMap.get(language);
        if (!result) {
            let query = this.configService
                .getSettings(notebook.resource)
                .datascience.variableQueries.find((v) => v.language === language);
            if (!query && language === PYTHON_LANGUAGE) {
                query = Settings.DefaultVariableQuery;
            }

            // Use the query to generate our regex
            if (query) {
                result = {
                    query: query.query,
                    parser: new RegExp(query.parseExpr, 'g')
                };
                this.languageToQueryMap.set(language, result);
            }
        }

        return result;
    }

    private getAllMatches(regex: RegExp, text: string): string[] {
        const result: string[] = [];
        let m: RegExpExecArray | null = null;
        // tslint:disable-next-line: no-conditional-assignment
        while ((m = regex.exec(text)) !== null) {
            if (m.index === regex.lastIndex) {
                regex.lastIndex += 1;
            }
            if (m.length > 1) {
                result.push(m[1]);
            }
        }
        // Rest after searching
        regex.lastIndex = -1;
        return result;
    }

    private async getVariablesBasedOnKernel(
        notebook: INotebook,
        request: IJupyterVariablesRequest
    ): Promise<IJupyterVariablesResponse> {
        // See if we already have the name list
        let list = this.notebookState.get(notebook.identity);
        if (!list || list.currentExecutionCount !== request.executionCount) {
            // Refetch the list of names from the notebook. They might have changed.
            list = {
                currentExecutionCount: request.executionCount,
                variables: (await this.getVariableNamesFromKernel(notebook)).map((n) => {
                    return {
                        name: n,
                        value: undefined,
                        supportsDataExplorer: false,
                        type: '',
                        size: 0,
                        shape: '',
                        count: 0,
                        truncated: true
                    };
                })
            };
        }

        const exclusionList = this.configService.getSettings(notebook.resource).datascience.variableExplorerExclude
            ? this.configService.getSettings().datascience.variableExplorerExclude?.split(';')
            : [];

        const result: IJupyterVariablesResponse = {
            executionCount: request.executionCount,
            pageStartIndex: -1,
            pageResponse: [],
            totalCount: 0,
            refreshCount: request.refreshCount
        };

        // Use the list of names to fetch the page of data
        if (list) {
            const startPos = request.startIndex ? request.startIndex : 0;
            const chunkSize = request.pageSize ? request.pageSize : 100;
            result.pageStartIndex = startPos;

            // Do one at a time. All at once doesn't work as they all have to wait for each other anyway
            for (let i = startPos; i < startPos + chunkSize && i < list.variables.length; ) {
                const fullVariable = list.variables[i].value
                    ? list.variables[i]
                    : await this.getVariableValueFromKernel(list.variables[i], notebook);

                // See if this is excluded or not.
                if (exclusionList && exclusionList.indexOf(fullVariable.type) >= 0) {
                    // Not part of our actual list. Remove from the real list too
                    list.variables.splice(i, 1);
                } else {
                    list.variables[i] = fullVariable;
                    result.pageResponse.push(fullVariable);
                    i += 1;
                }
            }

            // Save in our cache
            this.notebookState.set(notebook.identity, list);

            // Update total count (exclusions will change this as types are computed)
            result.totalCount = list.variables.length;
        }

        return result;
    }

    private async getVariableNamesFromKernel(notebook: INotebook): Promise<string[]> {
        // Get our query and parser
        const query = this.getParser(notebook);

        // Now execute the query
        if (notebook && query) {
            const cells = await notebook.execute(query.query, Identifiers.EmptyFileName, 0, uuid(), undefined, true);
            const text = this.extractJupyterResultText(cells);

            // Apply the expression to it
            const matches = this.getAllMatches(query.parser, text);

            // Turn each match into a value
            if (matches) {
                return matches;
            }
        }

        return [];
    }

    private async getVariableValueFromKernel(
        targetVariable: IJupyterVariable,
        notebook: INotebook
    ): Promise<IJupyterVariable> {
        let result = { ...targetVariable };
        if (notebook) {
            const output = await notebook.inspect(targetVariable.name);

            // Should be a text/plain inside of it (at least IPython does this)
            if (output && output.hasOwnProperty('text/plain')) {
                // tslint:disable-next-line: no-any
                const text = (output as any)['text/plain'].toString();

                // Parse into bits
                const type = TypeRegex.exec(text);
                const value = ValueRegex.exec(text);
                const stringForm = StringFormRegex.exec(text);
                const docString = DocStringRegex.exec(text);
                const count = CountRegex.exec(text);
                const shape = ShapeRegex.exec(text);
                if (type) {
                    result.type = type[1];
                }
                if (value) {
                    result.value = value[1];
                } else if (stringForm) {
                    result.value = stringForm[1];
                } else if (docString) {
                    result.value = docString[1];
                } else {
                    result.value = '';
                }
                if (count) {
                    result.count = parseInt(count[1], 10);
                }
                if (shape) {
                    result.shape = `(${shape[1]}, ${shape[2]})`;
                }
            }

            // Otherwise look for the appropriate entries
            if (output.type) {
                result.type = output.type.toString();
            }
            if (output.value) {
                result.value = output.value.toString();
            }

            // Determine if supports viewing based on type
            if (DataViewableTypes.has(result.type)) {
                result.supportsDataExplorer = true;
            }
        }

        // For a python kernel, we might be able to get a better shape. It seems the 'inspect' request doesn't always return it.
        // Do this only when necessary as this is a LOT slower than an inspect request. Like 4 or 5 times as slow
        if (
            result.type &&
            result.count &&
            !result.shape &&
            notebook.getKernelSpec()?.language === 'python' &&
            result.supportsDataExplorer &&
            result.type !== 'list' // List count is good enough
        ) {
            const computedShape = await this.runScript<IJupyterVariable>(
                notebook,
                result,
                result,
                () => this.fetchVariableShapeScript
            );
            // Only want shape and count from the request. Other things might have been destroyed
            result = { ...result, shape: computedShape.shape, count: computedShape.count };
        }

        return result;
    }
}
