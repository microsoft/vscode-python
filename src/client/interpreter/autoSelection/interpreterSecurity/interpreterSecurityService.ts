// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import { Resource } from '../../../common/types';
import { PythonInterpreter } from '../../../pythonEnvironments/discovery/types';
import { IInterpreterEvaluation, IInterpreterSecurityService, IInterpreterSecurityStorage } from '../types';

@injectable()
export class InterpreterSecurityService implements IInterpreterSecurityService {
    public _didSafeInterpretersChange = new EventEmitter<void>();
    constructor(
        @inject(IInterpreterSecurityStorage) private readonly interpreterSecurityStorage: IInterpreterSecurityStorage,
        @inject(IInterpreterEvaluation) private readonly interpreterEvaluation: IInterpreterEvaluation
    ) {}

    public isSafe(interpreter: PythonInterpreter, resource?: Resource): boolean | undefined {
        const unsafeInterpreters = this.interpreterSecurityStorage.unsafeInterpreters.value;
        if (unsafeInterpreters.includes(interpreter.path)) {
            return false;
        }
        const safeInterpreters = this.interpreterSecurityStorage.safeInterpreters.value;
        if (safeInterpreters.includes(interpreter.path)) {
            return true;
        }
        return this.interpreterEvaluation.inferValueUsingCurrentState(interpreter, resource);
    }

    public async evaluateAndRecordInterpreterSafety(interpreter: PythonInterpreter, resource: Resource): Promise<void> {
        const unsafeInterpreters = this.interpreterSecurityStorage.unsafeInterpreters.value;
        const safeInterpreters = this.interpreterSecurityStorage.safeInterpreters.value;
        if (unsafeInterpreters.includes(interpreter.path) || safeInterpreters.includes(interpreter.path)) {
            return;
        }
        const isSafe = await this.interpreterEvaluation.evaluateIfInterpreterIsSafe(interpreter, resource);
        if (isSafe) {
            await this.interpreterSecurityStorage.safeInterpreters.updateValue([interpreter.path, ...safeInterpreters]);
        } else {
            await this.interpreterSecurityStorage.unsafeInterpreters.updateValue([
                interpreter.path,
                ...unsafeInterpreters
            ]);
        }
        this._didSafeInterpretersChange.fire();
    }

    public get onDidChangeSafeInterpreters(): Event<void> {
        return this._didSafeInterpretersChange.event;
    }
}
