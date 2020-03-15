// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Memento } from 'vscode';
import { GLOBAL_MEMENTO, IMemento } from '../../../common/types';
import { noop } from '../../../common/utils/misc';

const key = 'INTERPRETER_PATH_SELECTED_FOR_JUPYTER_SERVER';
const keySelected = 'INTERPRETER_PATH_WAS_SELECTED_FOR_JUPYTER_SERVER';
/**
 * Keeps track of whether the user ever selected an interpreter to be used as the global jupyter interpreter.
 * Keeps track of the interpreter path of the interpreter used as the global jupyter interpreter.
 *
 * @export
 * @class JupyterInterpreterStateStore
 */
@injectable()
export class JupyterInterpreterStateStore {
    private _interpreterPath?: string;
    constructor(@inject(IMemento) @named(GLOBAL_MEMENTO) private readonly memento: Memento) {}

    /**
     * Whether the user set an interpreter at least once (an interpreter for starting of jupyter).
     *
     * @readonly
     * @type {Promise<boolean>}
     */
    public get interpreterSetAtleastOnce(): boolean {
        return !!this.selectedPythonPath || this.memento.get<boolean>(keySelected, false);
    }
    public get selectedPythonPath(): string | undefined {
        return this._interpreterPath || this.memento.get<string | undefined>(key, undefined);
    }
    public updateSelectedPythonPath(value: string | undefined) {
        this._interpreterPath = value;
        this.memento.update(key, value).then(noop, noop);
        this.memento.update(keySelected, true).then(noop, noop);
    }
}
