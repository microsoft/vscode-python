// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const modulesToExternalize = [
    '@nteract/transform-vega',
    '@nteract/transform-geojson',
    '@nteract/transform-dataresource',
    '@nteract/transform-model-debug',
    '@nteract/transform-plotly',
    '@nteract/transforms',
    '@nteract/transform-vdom'
];

function replaceModule(contents, moduleName, quotes) {
    const regExToSearch = `import\\(${quotes}${moduleName}${quotes}\\)`;
    const stringToReplaceWith = `new Promise(resolve => requirejs(['${moduleName}'], resolve))`;
    return contents.replace(new RegExp(regExToSearch, 'gm'), stringToReplaceWith);
}

/**
 * Finds instances of `await import('<module>')` and replaces them with `await new Promise(resolve => requirejs(['<module>'], resolve))`.
 * Basically ensures some modules are imported using `requirejs`.
 *
 * @param {*} source
 * @returns {string}
 */
exports.default = function plugin(source) {
    modulesToExternalize.forEach(item => {
        source = replaceModule(source, item, '"');
        source = replaceModule(source, item, "'");
    });
    return source;
};
