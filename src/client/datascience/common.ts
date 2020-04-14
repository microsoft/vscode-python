// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { Memento } from 'vscode';
import { splitMultilineString } from '../../datascience-ui/common';
import { noop } from '../common/utils/misc';
import { Settings } from './constants';

// Can't figure out a better way to do this. Enumerate
// the allowed keys of different output formats.
const dummyStreamObj: nbformat.IStream = {
    output_type: 'stream',
    name: 'stdout',
    text: ''
};
const dummyErrorObj: nbformat.IError = {
    output_type: 'error',
    ename: '',
    evalue: '',
    traceback: ['']
};
const dummyDisplayObj: nbformat.IDisplayData = {
    output_type: 'display_data',
    data: {},
    metadata: {}
};
const dummyExecuteResultObj: nbformat.IExecuteResult = {
    output_type: 'execute_result',
    name: '',
    execution_count: 0,
    data: {},
    metadata: {}
};
const AllowedKeys = {
    ['stream']: new Set(Object.keys(dummyStreamObj)),
    ['error']: new Set(Object.keys(dummyErrorObj)),
    ['display_data']: new Set(Object.keys(dummyDisplayObj)),
    ['execute_result']: new Set(Object.keys(dummyExecuteResultObj))
};

export function getSavedUriList(globalState: Memento): { uri: string; time: number }[] {
    const uriList = globalState.get<{ uri: string; time: number }[]>(Settings.JupyterServerUriList);
    return uriList
        ? uriList.sort((a, b) => {
              return b.time - a.time;
          })
        : [];
}
export function addToUriList(globalState: Memento, uri: string, time: number) {
    const uriList = getSavedUriList(globalState);

    const editList = uriList.filter((f, i) => {
        return f.uri !== uri && i < Settings.JupyterServerUriListMax - 1;
    });
    editList.splice(0, 0, { uri, time });

    globalState.update(Settings.JupyterServerUriList, editList).then(noop, noop);
}

function fixupOutput(output: nbformat.IOutput): nbformat.IOutput {
    let allowedKeys: Set<string>;
    switch (output.output_type) {
        case 'stream':
        case 'error':
        case 'execute_result':
        case 'display_data':
            allowedKeys = AllowedKeys[output.output_type];
            break;
        default:
            return output;
    }
    const result = { ...output };
    for (const k of Object.keys(output)) {
        if (!allowedKeys.has(k)) {
            delete result[k];
        }
    }
    return result;
}

export function pruneCell(cell: nbformat.ICell): nbformat.ICell {
    // Source is usually a single string on input. Convert back to an array
    const result = ({
        ...cell,
        source: splitMultilineString(cell.source)
        // tslint:disable-next-line: no-any
    } as any) as nbformat.ICell; // nyc (code coverage) barfs on this so just trick it.

    // Remove outputs and execution_count from non code cells
    if (result.cell_type !== 'code') {
        delete result.outputs;
        delete result.execution_count;
    } else {
        // Clean outputs from code cells
        result.outputs = (result.outputs as nbformat.IOutput[]).map(fixupOutput);
    }

    return result;
}
