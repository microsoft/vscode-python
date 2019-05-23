// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-console no-require-imports no-var-requires

import * as path from "path";

process.env.CODE_TESTS_WORKSPACE = path.join(
    __dirname,
    "..",
    "..",
    "src",
    "testMultiRootWkspc",
    "multi.code-workspace"
);
process.env.IS_CI_SERVER_TEST_DEBUGGER = "1";
process.env.VSC_PYTHON_CI_TEST = "1";

function start() {
    console.log("*".repeat(100));
    console.log("Start Debugger tests");
    require("../../node_modules/vscode/bin/test");
}
start();
