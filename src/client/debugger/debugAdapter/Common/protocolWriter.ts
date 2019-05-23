// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";

import { injectable } from "inversify";
import { Socket } from "net";
import { Message } from "vscode-debugadapter/lib/messages";
import { IProtocolMessageWriter } from "../types";

const TWO_CRLF = "\r\n\r\n";

@injectable()
export class ProtocolMessageWriter implements IProtocolMessageWriter {
    public write(stream: Socket | NodeJS.WriteStream, message: Message): void {
        const json = JSON.stringify(message);
        const length = Buffer.byteLength(json, "utf8");

        stream.write(`Content-Length: ${length.toString()}${TWO_CRLF}`, "utf8");
        stream.write(json, "utf8");
    }
}
