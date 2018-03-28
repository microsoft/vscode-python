// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:quotemark ordered-imports no-any no-empty curly member-ordering one-line max-func-body-length no-var-self prefer-const cyclomatic-complexity prefer-template

import { DebugSession } from "vscode-debugadapter";
import { IPythonProcess, IDebugServer, AttachRequestArguments } from "../Common/Contracts";
import { connect, Socket } from "net";
import { BaseDebugServer } from "./BaseDebugServer";

export class RemoteDebugServerV2 extends BaseDebugServer {
    private args: AttachRequestArguments;
    private socket?: Socket;
    constructor(debugSession: DebugSession, pythonProcess: IPythonProcess, args: AttachRequestArguments) {
        super(debugSession, pythonProcess);
        this.args = args;
    }

    public Stop() {
        if (this.socket) {
            this.socket.destroy();
        }
    }
    public Start(): Promise<IDebugServer> {
        return new Promise<IDebugServer>((resolve, reject) => {
            let portNumber = this.args.port;
            let options = { port: portNumber! };
            if (typeof this.args.host === "string" && this.args.host.length > 0) {
                (<any>options).host = this.args.host;
            }
            try {
                const socket = connect(options, () => {
                    this.socket = socket;
                    this.clientSocket.resolve(socket);
                    resolve(options);
                });
            } catch (ex) {
                reject(ex);
            }
        });
    }
}
