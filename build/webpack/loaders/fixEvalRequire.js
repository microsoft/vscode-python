// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-default-export no-invalid-this
function default_1(source) {
    if (source.indexOf('eval') > 0) {
        let matches = source.match(/eval\('require'\)\('.*'\)/gm) || [];
        matches.forEach(item => {
            const moduleName = item.split('\'')[3];
            const stringToReplaceWith = `require('${moduleName}')`;
            source = source.replace(item, stringToReplaceWith);
        });
        matches = source.match(/eval\("require"\)\(".*"\)/gm) || [];
        matches.forEach(item => {
            const moduleName = item.split('\'')[3];
            const stringToReplaceWith = `require("${moduleName}")`;
            source = source.replace(item, stringToReplaceWith);
        });
    }
    return source;
}
exports.default = default_1;
