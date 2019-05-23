// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
"use strict";
import "./sysInfo.css";

import * as React from "react";

// tslint:disable-next-line:match-default-export-name import-name
interface ISysInfoProps {
    message: string;
    path: string;
    notebook_version: string;
    version: string;
    theme: string;
    connection: string;
}

export class SysInfo extends React.Component<ISysInfoProps> {
    constructor(prop: ISysInfoProps) {
        super(prop);
    }

    public render() {
        const connectionString =
            this.props.connection.length > 0
                ? `${this.props.connection}\r\n`
                : "";
        const output = `${connectionString}${this.props.message}\r\n${
            this.props.version
        }\r\n${this.props.path}\r\n${this.props.notebook_version}`;

        return (
            <div className="sysinfo-wrapper">
                <div className="sysinfo-outer">
                    <div className="sysinfo-result-container">
                        <pre>
                            <span>{output}</span>
                        </pre>
                    </div>
                </div>
            </div>
        );
    }
}
