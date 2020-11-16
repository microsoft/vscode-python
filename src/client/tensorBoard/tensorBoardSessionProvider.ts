// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { traceInfo } from '../common/logger';
import { IInstaller } from '../common/types';
import { IInterpreterService } from '../interpreter/contracts';
import { TensorBoardSession } from './tensorBoardSession';
import { ITensorBoardSessionProvider } from './types';

@injectable()
export class TensorBoardSessionProvider implements ITensorBoardSessionProvider {
    private sessions: TensorBoardSession[] = [];

    constructor(
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService
    ) {}

    public getOrCreate(): Promise<TensorBoardSession> {
        return this.createNewSession();
    }

    private async createNewSession() {
        traceInfo('Creating new TensorBoard session');
        const newSession = new TensorBoardSession(this.installer, this.interpreterService);
        await newSession.initialize();
        this.sessions.push(newSession);
        return newSession;
    }
}
