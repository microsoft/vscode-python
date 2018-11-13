// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';

// tslint:disable:no-default-export no-invalid-this
export default function (source: string) {
    const sourcePath: string = this.resourcePath;
    if (sourcePath.indexOf('node_modules') === -1 && source.indexOf('unicode/category') > 0) {
        const relativePathToOutClient = path.relative(sourcePath, path.join(__dirname, '..', '..', 'out', 'client'));
        console.log(relativePathToOutClient);
        // return source
        //     .replace(/\'unicode\/category\/Lu\'/g, '\'./unicode_category_Lu\'')
        //     .replace(/\'unicode\/category\/Ll\'/g, '\'./unicode_category_Ll\'')
        //     .replace(/\'unicode\/category\/Lt\'/g, '\'./unicode_category_Lt\'')
        //     .replace(/\'unicode\/category\/Lo\'/g, '\'./unicode_category_Lo\'')
        //     .replace(/\'unicode\/category\/Lm\'/g, '\'./unicode_category_Lm\'')
        //     .replace(/\'unicode\/category\/Nl\'/g, '\'./unicode_category_Nl\'')
        //     .replace(/\'unicode\/category\/Mn\'/g, '\'./unicode_category_Mn\'')
        //     .replace(/\'unicode\/category\/Nd\'/g, '\'./unicode_category_Nd\'')
        //     .replace(/\'unicode\/category\/Pc\'/g, '\'./unicode_category_Pc\'');
    }
    // console.log(this.resourcePath);
    // const normalizedFilePath = normalizePath(this.resourcePath);
    // if (normalizedFilePath.startsWith(normalizedNodeModulesPath)) {
    //     const options = getOptions(this) as Options;
    //     // console.log(options);
    //     const pathRelativeToNodeModules = normalizedFilePath.substring(normalizedNodeModulesPath.length + 1);
    //     const dirName = pathRelativeToNodeModules.split('/')[0];
    //     if (options.nodeModuleBundles.has(pathRelativeToNodeModules) && this.resourcePath.indexOf(dirName) === -1) {
    //         const bundleModule = options.nodeModuleBundles.get(pathRelativeToNodeModules);
    //         const name = Array.isArray(bundleModule) ? bundleModule[0] : bundleModule;
    //         const defaultSuffix = Array.isArray(bundleModule) ? '.default' : '';
    //         // return `export require('${name}')${defaultSuffix};`;
    //         return `
    //         function __export(m) {
    //             for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
    //         }
    //         __export(require('${name}'));
    //         `;
    //     }
    //     // console.log(this.resourcePath);
    //     console.log(`${pathRelativeToNodeModules} in ${this.resourcePath}`);
    //     // console.log('Failed');
    // }
    return source;
}

// // import { getOptions } from 'loader-utils';
// // import validateOptions from 'schema-utils';
//  // const schema = {
// //   type: 'object',
// //   properties: {
// //     test: {
// //       type: 'string'
// //     }
// //   }
// // };
// // tslint:disable-next-line:no-default-export
// export default function (source) {
//     //   const options = getOptions(this);
//      //   validateOptions(schema, options, 'Example Loader');
//      // Apply some transformations to the source...
//     const obj = { one: 1 };
//     if (this.resourcePath.endsWith('node_modules/unicode/category/Nl.js') ||
//         this.resourcePath.endsWith('node_modules/unicode/category/Lo.js')) {
//         console.log('this.resourcePath');
//         console.log(this.resourcePath);
//         return `const x = require('out/client/unicode_category_Llxyz.js');\nexport default x;`;
//     }
//     return source;
// };
