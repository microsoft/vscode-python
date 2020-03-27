// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Memento } from 'vscode';
import { noop } from '../common/utils/misc';
import { Settings } from './constants';

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
