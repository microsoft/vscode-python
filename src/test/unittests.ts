// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable:no-any no-require-imports no-var-requires

if ((Reflect as any).metadata === undefined) {
    require('reflect-metadata');
}

process.env.VSC_PYTHON_CI_TEST = '1';
process.env.VSC_PYTHON_UNIT_TEST = '1';

import { setUpDomEnvironment } from './datascience/reactHelpers';
import { initialize } from './vscode-mock';

// Custom module loader so we skip .css files that break non webpack wrapped compiles
// tslint:disable-next-line:no-var-requires no-require-imports
const Module = require('module');

// Required for DS functional tests.
// tslint:disable-next-line:no-function-expression
(function () {
    const origRequire = Module.prototype.require;
    const _require = (context: any, filepath: any) => {
        return origRequire.call(context, filepath);
    };
    Module.prototype.require = function (filepath: any) {
        if (filepath.endsWith('.css') || filepath.endsWith('.svg')) {
            return '';
        }
        // tslint:disable-next-line:no-invalid-this
        return _require(this, filepath);
    };
})();

// nteract/transforms-full expects to run in the browser so we have to fake
// parts of the browser here.
setUpDomEnvironment();
initialize();
