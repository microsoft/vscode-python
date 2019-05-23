// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";

import { expect } from "chai";
import * as TypeMoq from "typemoq";
import { WorkspaceConfiguration } from "vscode";
import { IWorkspaceService } from "../../../client/common/application/types";
import { HttpClient } from "../../../client/common/net/httpClient";
import { IServiceContainer } from "../../../client/ioc/types";

suite("Http Client", () => {
    test("Get proxy info", async () => {
        const container = TypeMoq.Mock.ofType<IServiceContainer>();
        const workSpaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        const config = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const proxy = "https://myproxy.net:4242";
        config
            .setup(c =>
                c.get(TypeMoq.It.isValue("proxy"), TypeMoq.It.isValue(""))
            )
            .returns(() => proxy)
            .verifiable(TypeMoq.Times.once());
        workSpaceService
            .setup(w => w.getConfiguration(TypeMoq.It.isValue("http")))
            .returns(() => config.object)
            .verifiable(TypeMoq.Times.once());
        container
            .setup(a => a.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workSpaceService.object);

        const httpClient = new HttpClient(container.object);

        config.verifyAll();
        workSpaceService.verifyAll();
        expect(httpClient.requestOptions).to.deep.equal({ proxy: proxy });
    });
});
