// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export { WidgetManager } from './manager';
import * as base from '@jupyter-widgets/base';
import * as widgets from '@jupyter-widgets/controls';
import * as outputWidgets from '@jupyter-widgets/jupyterlab-manager/lib/output';
import * as embed from './embed';
import './widgets.css';

// Special case until azure ml is up on unpkg.com, load the azureml widget from local js
// tslint:disable-next-line: no-var-requires no-require-imports
const azureMLWidgets = require('./azureml/index');

// Export the following for `requirejs`.
// tslint:disable-next-line: no-any no-function-expression no-empty
const define = (window as any).define || function () {};
define('@jupyter-widgets/controls', () => widgets);
define('@jupyter-widgets/base', () => base);
define('@jupyter-widgets/output', () => outputWidgets);
define('azureml_widgets', () => azureMLWidgets);

// Render existing widgets without a kernel and pull in the correct css files
// This is not done yet. See this issue here: https://github.com/microsoft/vscode-python/issues/10794
// Likely we'll do this in a different spot.
if (document.readyState === 'complete') {
    embed.renderWidgets();
} else {
    window.addEventListener('load', () => {
        embed.renderWidgets();
    });
}
