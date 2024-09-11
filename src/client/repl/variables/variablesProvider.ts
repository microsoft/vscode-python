// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
    CancellationToken,
    NotebookDocument,
    Variable,
    NotebookVariablesRequestKind,
    VariablesResult,
    EventEmitter,
    NotebookVariableProvider,
} from 'vscode';
import * as path from 'path';
import * as fsapi from '../../common/platform/fs-paths';
import { VariableResultCache } from './variableResultCache';
import { PythonServer } from '../pythonServer';
import { IVariableDescription } from './types';
import { EXTENSION_ROOT_DIR } from '../../constants';

const VARIABLE_SCRIPT_LOCATION = path.join(EXTENSION_ROOT_DIR, 'python_files', 'get_variable_info.py');

export class VariablesProvider implements NotebookVariableProvider {
    public static scriptContents: string | undefined;

    private variableResultCache = new VariableResultCache();

    private _onDidChangeVariables = new EventEmitter<NotebookDocument>();

    onDidChangeVariables = this._onDidChangeVariables.event;

    private executionCount = 0;

    constructor(private readonly pythonServer: PythonServer) {}

    // TODO: signal that variables have chagned when the server executes user code

    async *provideVariables(
        notebook: NotebookDocument,
        parent: Variable | undefined,
        kind: NotebookVariablesRequestKind,
        start: number,
        token: CancellationToken,
    ): AsyncIterable<VariablesResult> {
        // TODO: check if server is running
        if (token.isCancellationRequested) {
            return;
        }

        // eslint-disable-next-line no-plusplus
        const executionCount = this.executionCount++;

        const cacheKey = getVariableResultCacheKey(notebook.uri.toString(), parent, start);
        let results = this.variableResultCache.getResults(executionCount, cacheKey);

        if (parent) {
            const parentDescription = parent as IVariableDescription;
            if (!results && parentDescription.getChildren) {
                const variables = await parentDescription.getChildren(start, token);
                results = variables.map((variable) => this.createVariableResult(variable));
                this.variableResultCache.setResults(executionCount, cacheKey, results);
            } else if (!results) {
                // no cached results and no way to get children, so return empty
                return;
            }

            for (const result of results) {
                yield result;
            }

            // check if we have more indexed children to return
            if (
                kind === 2 &&
                parentDescription.count &&
                results.length > 0 &&
                parentDescription.count > start + results.length
            ) {
                for await (const result of this.provideVariables(
                    notebook,
                    parent,
                    kind,
                    start + results.length,
                    token,
                )) {
                    yield result;
                }
            }
        } else {
            if (!results) {
                const variables = await this.getAllVariableDiscriptions(undefined, start, token);
                results = variables.map((variable) => this.createVariableResult(variable));
                this.variableResultCache.setResults(executionCount, cacheKey, results);
            }

            for (const result of results) {
                yield result;
            }
        }
    }

    private createVariableResult(result: IVariableDescription): VariablesResult {
        const indexedChildrenCount = result.count ?? 0;
        const hasNamedChildren = !!result.hasNamedChildren;
        const variable = {
            getChildren: (start: number, token: CancellationToken) => this.getChildren(variable, start, token),
            expression: createExpression(result.root, result.propertyChain),
            ...result,
        } as Variable;
        return { variable, hasNamedChildren, indexedChildrenCount };
    }

    async getChildren(variable: Variable, start: number, token: CancellationToken): Promise<IVariableDescription[]> {
        const parent = variable as IVariableDescription;
        return this.getAllVariableDiscriptions(parent, start, token);
    }

    async getAllVariableDiscriptions(
        parent: IVariableDescription | undefined,
        start: number,
        token: CancellationToken,
    ): Promise<IVariableDescription[]> {
        const scriptLines = (await getContentsOfVariablesScript()).split(/(?:\r\n|\n)/);
        if (parent) {
            const printCall = `return _VSCODE_getAllChildrenDescriptions(\'${parent.root}\', ${JSON.stringify(
                parent.propertyChain,
            )}, ${start})`;
            scriptLines.push(printCall);
        } else {
            scriptLines.push('return _VSCODE_getVariableDescriptions()');
        }

        if (token.isCancellationRequested) {
            return [];
        }

        const script = wrapScriptInFunction(scriptLines);
        const result = await this.pythonServer.execute(script);

        if (result?.output && !token.isCancellationRequested) {
            return JSON.parse(result.output) as IVariableDescription[];
        }

        return [];
    }
}

function wrapScriptInFunction(scriptLines: string[]): string {
    const indented = scriptLines.map((line) => `    ${line}`).join('\n');
    // put everything into a function scope and then delete that scope
    // TODO: run in a background thread
    return `def __VSCODE_run_script():\n${indented}\nprint(__VSCODE_run_script())\ndel __VSCODE_run_script`;
}

async function getContentsOfVariablesScript(): Promise<string> {
    if (VariablesProvider.scriptContents) {
        return VariablesProvider.scriptContents;
    }
    const contents = await fsapi.readFile(VARIABLE_SCRIPT_LOCATION, 'utf-8');
    VariablesProvider.scriptContents = contents;
    return VariablesProvider.scriptContents;
}

function createExpression(root: string, propertyChain: (string | number)[]): string {
    let expression = root;
    for (const property of propertyChain) {
        if (typeof property === 'string') {
            expression += `.${property}`;
        } else {
            expression += `[${property}]`;
        }
    }
    return expression;
}

function getVariableResultCacheKey(notebookUri: string, parent: Variable | undefined, start: number) {
    let parentKey = '';
    const parentDescription = parent as IVariableDescription;
    if (parentDescription) {
        parentKey = `${parentDescription.name}.${parentDescription.propertyChain.join('.')}[[${start}`;
    }
    return `${notebookUri}:${parentKey}`;
}
