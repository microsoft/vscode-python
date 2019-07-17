const Application = require('spectron').Application;
const assert = require('assert');
const electronPath = require('electron'); // Require Electron from the binaries included in node_modules.
const path = require('path');

async function start() {
    const app = new Application({
        // Your electron path can be any binary
        // i.e for OSX an example path could be '/Applications/MyApp.app/Contents/MacOS/MyApp'
        // But for the sake of the example we fetch it from our node_modules.
        path: '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/.vscode test/stable/Visual Studio Code.app/Contents/MacOS/Electron',

        // Assuming you have the following directory structure

        //  |__ my project
        //     |__ ...
        //     |__ main.js
        //     |__ package.json
        //     |__ index.html
        //     |__ ...
        //     |__ test
        //        |__ spec.js  <- You are here! ~ Well you should be.

        // The following line tells spectron to look and use the main.js file
        // and the package.json located 1 level above.
        args: [path.join(__dirname, '..')]
    });
    await app.start();
    await app.client.getWindowCount().then(function(count) {
        assert.equal(count, 1);
        // Please note that getWindowCount() will return 2 if `dev tools` are opened.
        // assert.equal(count, 2)
    });
}

start().catch(console.error);
