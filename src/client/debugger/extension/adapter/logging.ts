// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as fs from 'fs';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { DebugAdapterTracker, DebugAdapterTrackerFactory, DebugSession, ProviderResult } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';

import { IFileSystem } from '../../../common/platform/types';
import { EXTENSION_ROOT_DIR } from '../../../constants';

class DebugSessionLoggingTracker implements DebugAdapterTracker {
    private readonly session: DebugSession;
    private readonly enabled: boolean = false;
    private stream: fs.WriteStream;
    constructor(session: DebugSession, fileSystem: IFileSystem) {
        this.session = session;
        this.enabled = this.session.configuration.logToFile as boolean;
        const fileName = `debug_ext_${this.session.id}.log`;
        this.stream = fileSystem.createWriteStream(path.join(EXTENSION_ROOT_DIR, fileName));
    }

    public onWillStartSession() {
        if (this.enabled) {
            this.stream.write(`Starting debug session with configuration: ${this.session.configuration}`);
            // write start
        }
    }
    public onWillReceiveMessage(_message: DebugProtocol.Message) {
        if (this.enabled) {
            // write received message with time stamp
        }
    }
    public onDidSendMessage(_message: DebugProtocol.Message) {
        if (this.enabled) {
            // write sent message with time stamp
        }
    }
    public onWillStopSession() {
        if (this.enabled) {
            // write stopped session details with message
        }
    }
    public onError(_error: Error) {
        if (this.enabled) {
            // write any error details
        }
    }
    public onExit(_code: number | undefined, _signal: string | undefined) {
        if (this.enabled) {
            // write any exit details
        }
    }
}

@injectable()
export class DebugSessionLoggingFactory implements DebugAdapterTrackerFactory {
    constructor(
        @inject(IFileSystem) private readonly fileSystem: IFileSystem
    ) {
    }

    public createDebugAdapterTracker(session: DebugSession): ProviderResult<DebugAdapterTracker> {
        return new DebugSessionLoggingTracker(session, this.fileSystem);
    }
}
