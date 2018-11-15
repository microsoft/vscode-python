// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-default-export no-invalid-this
function default_1(source) {
    const sourcePath = this.resourcePath;
    if (sourcePath.indexOf('node_modules') === -1) {
        if (source.indexOf('unicode/category') > 0) {
            source = source.replace(/\'unicode\/category\//gm, '\'./unicode_category_');
            source = source.replace(/"unicode\/category\//gm, '"./unicode_category_');
        }
        if (source.indexOf('@jupyterlab\/services') > 0) {
            console.log('Updated Jupyter Services');
            source = source.replace(/\'@jupyterlab\/services\'/gm, '\'./@jupyterlab/services\'');
            source = source.replace(/"@jupyterlab\/services"/gm, '"./@jupyterlab/services"');
        }
        if (source.indexOf('azure-storage') > 0) {
            source = source.replace(/\'azure-storage\'/gm, '\'./azure-storage\'');
            source = source.replace(/"azure-storage"/gm, '"./azure-storage"');
        }
    }
    return source;
}
exports.default = default_1;
