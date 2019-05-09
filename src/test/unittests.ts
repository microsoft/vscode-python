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

// Special case for the node_modules\monaco-editor\esm\vs\editor\browser\config\configuration.js. It doesn't
// export the function we need to dispose of the timer it's set. So force it to.
const configurationRegex = /.*(\\|\/)node_modules(\\|\/)monaco-editor(\\|\/)esm(\\|\/)vs(\\|\/)editor(\\|\/)browser(\\|\/)config(\\|\/)configuration\.js/g;
const _oldLoader = require.extensions['.js'];
// tslint:disable-next-line:no-function-expression
require.extensions['.js'] = function(mod: any, filename) {
    if (configurationRegex.test(filename)) {
        let content = require('fs').readFileSync(filename, 'utf8');
        content += 'export function getCSSBasedConfiguration() { return CSSBasedConfiguration.INSTANCE; };\n';
        mod._compile(content, filename);
    } else {
        _oldLoader(mod, filename);
    }
};

// nteract/transforms-full expects to run in the browser so we have to fake
// parts of the browser here.
setUpDomEnvironment();
initialize();

// We need to babel transpile some modules. Monaco-editor is not in commonJS format so imports
// can't be loaded.
require('@babel/register')({ plugins: ['@babel/transform-modules-commonjs'], only: [ /monaco-editor/ ] });
