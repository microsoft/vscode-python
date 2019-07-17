// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as colors from 'colors/safe';

/**
 * Dirty way to display CLI options.
 * (we don't want anything fancy as we're using cucumber-js to launch the tests)
 * Hence the arguments we pass into npm run smokeTest get passed into cucumber-js, then our code.
 * If we want to get fancy and create our CLI, then invoke cucumber using `node_modules/cucumber/lib/cli/run.js`.
 * (though that would be a hack, as we'd need to inject arguments into process.args).
 * @export
 */
export function showCli() {
    // tslint:disable-next-line: no-multiline-string
    const help = `
Use the following command to run the Smoke tests.
npm run smokeTest -- <cucumber args> <custom args>
* Cucumber Args:
    * Please check cucumber-js cli ('./node_modules/cucumber/bin/cucumber-js --help')
* Smoke Test Args:
    * --channel     'insider' or 'stable'
                    VS Code Channel to install.
                    Defaults to 'stable'
    * --pythonPath  <fully qualified path to Python>
                    Python executabled to be used by the extension.
                    Defaults to 'python'

Examples:
* npm run smokeTest -- --channel=insider --pythonPath=/usr/bin/python3
`;

    // tslint:disable-next-line: no-console
    console.log(colors.green(help));
}
