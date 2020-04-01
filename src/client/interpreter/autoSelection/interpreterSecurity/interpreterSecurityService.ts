// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import { IPersistentState, IPersistentStateFactory, Resource } from '../../../common/types';
import { PythonInterpreter } from '../../contracts';
import { safeInterpretersKey, unsafeInterpretersKey } from '../constants';
import { IInterpreterEvaluation, IInterpreterSecurityService } from '../types';

@injectable()
export class InterpreterSecurityService implements IInterpreterSecurityService {
    public _didSafeInterpretersChange = new EventEmitter<void>();
    private unsafeInterpreters: IPersistentState<string[]>;
    private safeInterpreters: IPersistentState<string[]>;
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IInterpreterEvaluation) private readonly interpreterEvaluation: IInterpreterEvaluation
    ) {
        this.unsafeInterpreters = this.persistentStateFactory.createGlobalPersistentState<string[]>(
            unsafeInterpretersKey,
            []
        );
        this.safeInterpreters = this.persistentStateFactory.createGlobalPersistentState<string[]>(
            safeInterpretersKey,
            []
        );
    }

    public isSafe(interpreter: PythonInterpreter, resource?: Resource): boolean | undefined {
        const unsafeInterpreters = this.unsafeInterpreters.value;
        if (unsafeInterpreters.includes(interpreter.path)) {
            return false;
        }
        const safeInterpreters = this.safeInterpreters.value;
        if (safeInterpreters.includes(interpreter.path)) {
            return true;
        }
        return this.interpreterEvaluation.inferValueUsingStorage(interpreter, resource);
    }

    public async evaluateInterpreterSafety(interpreter: PythonInterpreter, resource: Resource): Promise<void> {
        const unsafeInterpreters = this.unsafeInterpreters.value;
        const safeInterpreters = this.safeInterpreters.value;
        if (unsafeInterpreters.includes(interpreter.path) || safeInterpreters.includes(interpreter.path)) {
            return;
        }
        const isSafe = await this.interpreterEvaluation.evaluateIfInterpreterIsSafe(interpreter, resource);
        if (isSafe) {
            await this.safeInterpreters.updateValue([interpreter.path, ...safeInterpreters]);
        } else {
            await this.unsafeInterpreters.updateValue([interpreter.path, ...unsafeInterpreters]);
        }
        this._didSafeInterpretersChange.fire();
    }

    public get onDidChangeSafeInterpreters(): Event<void> {
        return this._didSafeInterpretersChange.event;
    }
}
