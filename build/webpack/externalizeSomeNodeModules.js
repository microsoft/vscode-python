// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
// tslint:disable:no-default-export no-invalid-this
function default_1(source) {
    const sourcePath = this.resourcePath;
    if (sourcePath.indexOf('node_modules') === -1 && sourcePath.endsWith('unicode.ts')) {
        console.log('Hello');
        const x = source
            .replace(/unicode\/category\//g, './unicode_category_');
        //         // .replace(/\'unicode\/category\/Ll\'/g, `'./unicode_category_Ll'`)
        //         // .replace(/\'unicode\/category\/Lt\'/g, `'./unicode_category_Lt'`)
        //         // .replace(/\'unicode\/category\/Lo\'/g, `'./unicode_category_Lo'`)
        //         // .replace(/\'unicode\/category\/Lm\'/g, `'./unicode_category_Lm'`)
        //         // .replace(/\'unicode\/category\/Nl\'/g, `'./unicode_category_Nl'`)
        //         // .replace(/\'unicode\/category\/Nd\'/g, `'./unicode_category_Nd'`)
        //         // .replace(/\'unicode\/category\/Mc\'/g, `'./unicode_category_Mcc'`)
        //         // .replace(/\'unicode\/category\/Mn\'/g, `'./unicode_category_Mn'`)
        //         // .replace(/\'unicode\/category\/Pc\'/g, `'./unicode_category_Pc'`);
        const fs = require('fs');
        fs.writeFileSync('/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/build/x.ts', x);
        return x;
    }
    return source;
}
exports.default = default_1;
