// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import { expect } from 'chai';
import { Then, When } from 'cucumber';
import { CucumberRetryMax5Seconds } from '../constants';
import { IApplication, TestExplorerNodeStatus } from '../types';

Then('the test explorer icon will be visible', async function() {
    await this.app.testExplorer.waitUntilIconVisible(5_000);
});

// Surely tests can't take more than 30s to get discovered.
When('I wait for test discovery to complete', async function() {
    await this.app.testExplorer.waitUntilTestsStop(30_000);
});

// Surely pythonn tests (in our UI Tests) can't take more than 30s to run.
When('I wait for tests to complete running', async function() {
    await this.app.testExplorer.waitUntilTestsStop(30_000);
});

Then('there are {int} nodes in the test explorer', CucumberRetryMax5Seconds, async function(expectedCount: number) {
    const count = await this.app.testExplorer.getNodeCount();
    expect(count).to.equal(expectedCount);
});
Then('all of the test tree nodes have a progress icon', CucumberRetryMax5Seconds, async function() {
    const elements = await this.app.testExplorer.getNodes();
    const progressCount = elements.filter(node => node.status === 'Progress').length;
    expect(progressCount).to.equal(elements.length);
});
async function getNumberOfNodesWithIcon(app: IApplication, status: TestExplorerNodeStatus): Promise<number> {
    const elements = await app.testExplorer.getNodes();
    return elements.filter(node => node.status === status).length;
}
Then('{int} nodes in the test explorer have a status of "{word}"', CucumberRetryMax5Seconds, async function(count: number, status: TestExplorerNodeStatus) {
    const nodeCount = await getNumberOfNodesWithIcon(this.app, status);
    expect(nodeCount).to.equal(count);
});
Then('1 node in the test explorer has a status of "{word}"', CucumberRetryMax5Seconds, async function(status: TestExplorerNodeStatus) {
    const nodeCount = await getNumberOfNodesWithIcon(this.app, status);
    expect(nodeCount).to.equal(1);
});
Then('the node {string} in the test explorer has a status of "{word}"', CucumberRetryMax5Seconds, async function(label: string, status: TestExplorerNodeStatus) {
    const node = await this.app.testExplorer.getNode(label);
    expect(node.status).to.equal(status);
});

Then('the stop icon is visible in the toolbar', async function() {
    await this.app.testExplorer.waitUntilToolbarIconVisible('Stop');
});
Then('the run failed tests icon is visible in the toolbar', async function() {
    await this.app.testExplorer.waitUntilToolbarIconVisible('RunFailedTests');
});
Then('I stop discovering tests', async function() {
    await this.app.testExplorer.clickToolbarIcon('Stop');
});
When('I stop running tests', async function() {
    await this.app.testExplorer.clickToolbarIcon('Stop');
});
When('I run failed tests', async function() {
    await this.app.testExplorer.clickToolbarIcon('RunFailedTests');
});

Then('the stop icon is not visible in the toolbar', async function() {
    await this.app.testExplorer.waitUntilToolbarIconVisible('Stop');
});
When('I click the test node with the label {string}', async function(label: string) {
    await this.app.testExplorer.clickNode(label);
});
When('I navigate to the code associated with the test node {string}', async function(label: string) {
    await this.app.testExplorer.selectActionForNode(label, 'open');
});
// tslint:disable: no-invalid-this no-any restrict-plus-operands no-console
When('I debug the node {string} from the test explorer', async function(label: string) {
    await this.app.testExplorer.selectActionForNode(label, 'debug');
});
When('I run the node {string} from the test explorer', async function(label: string) {
    await this.app.testExplorer.selectActionForNode(label, 'run');
});
When('I expand all of the nodes in the test explorer', async function() {
    await this.app.testExplorer.expandNodes();
});

// Given('the test framework is {word}', async function (testFramework: string) {
//     await updateSetting('python.unitTest.nosetestsEnabled', testFramework === 'nose', context.app.workspacePathOrFolder);
//     await updateSetting('python.unitTest.pyTestEnabled', testFramework === 'pytest', context.app.workspacePathOrFolder);
//     await updateSetting('python.unitTest.unittestEnabled', testFramework === 'unittest', context.app.workspacePathOrFolder);
// });
// Then('wait for the test icon to appear within {int} seconds', async function (timeout: number) {
//     const icon = '.part.activitybar.left .composite-bar li a[title="Test"]';
//     await context.app.code.waitForElement(icon, undefined, timeout * 1000 / 250, 250);
//     await sleep(250);
// });
// Then('wait for the toolbar button with the text {string} to appear within {int} seconds', async function (title: string, timeout: number) {
//     const button = `div[id = "workbench.parts.sidebar"] a[title = "${title}"]`;
//     await context.app.code.waitForElement(button, undefined, timeout * 1000 / 250, 250);
//     await sleep(1000);
// Then('the toolbar button with the text {string} is visible', async function (title: string) {
// });
//     await context.app.code.waitForElement(`div[id = "workbench.parts.sidebar"] a[title = "${title}"]`);
// });
// Then('the toolbar button with the text {string} is not visible', async function (title: string) {
//     const eles = await context.app.code.waitForElements('div[id="workbench.parts.sidebar"] ul[aria-label="PYTHON actions"] li a', true);
//     assert.equal(eles.find(ele => ele.attributes['title'] === title), undefined);
// });
// Then('select first node', async function () {
//     // await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.has-children:nth-child(1) a.label-name:nth-child(1n)');
//     await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.monaco-tree-row:nth-child(1) a.label-name:nth-child(1n)');
// });
// Then('select second node', async function () {
//     // await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.has-children:nth-child(2) a.label-name:nth-child(1n)');
//     await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.monaco-tree-row:nth-child(2) a.label-name:nth-child(1n)');
// });
// Then('has {int} error test items', async function (count: number) {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="status-error.svg"]', true);
//     assert.equal(eles.length, count);
// });
// Then('there are at least {int} error test items', async function (count: number) {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="status-error.svg"]', true);
//     expect(eles).to.be.lengthOf.greaterThan(count - 1);
// });
// Then('there are at least {int} error test items', async function (count: number) {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="status-error.svg"]', true);
//     expect(eles).to.be.lengthOf.greaterThan(count - 1);
// });
// Then('there are {int} success test items', async function (count: number) {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="status-ok.svg"]', true);
//     assert.equal(eles.length, count);
// });
// Then('there are {int} running test items', async function (count: number) {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="discovering-tests.svg"]', true);
//     assert.equal(eles.length, count);
// });
// Then('there are at least {int} running test items', async function (count: number) {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="discovering-tests.svg"]', true);
//     expect(eles).to.be.lengthOf.greaterThan(count - 1);
// });
// When('I select test tree node number {int} and press run', async function (nodeNumber: number) {
//     await highlightNode(nodeNumber);
//     const selector = `div.monaco - tree - row: nth - child(${ nodeNumber }) div.monaco - icon - label.custom - view - tree - node - item - resourceLabel > div.actions > div > ul a[title = "Run"]`;
//     await context.app.code.waitAndClick(selector);
// });
// When('I select test tree node number {int} and press open', async function (nodeNumber: number) {
//     await highlightNode(nodeNumber);
//     const selector = `div.monaco - tree - row: nth - child(${ nodeNumber }) div.monaco - icon - label.custom - view - tree - node - item - resourceLabel a[title = "Open"]`;
//     await context.app.code.waitAndClick(selector);
// });
// When('I select test tree node number {int} and press debug', async function (nodeNumber: number) {
//     await highlightNode(nodeNumber);
//     const selector = `div.monaco - tree - row: nth - child(${ nodeNumber }) div.monaco - icon - label.custom - view - tree - node - item - resourceLabel a[title = "Debug"]`;
//     await context.app.code.waitAndClick(selector);
// });
// When('I select test tree node number {int}', async function (nodeNumber: number) {
//     await highlightNode(nodeNumber);
//     await context.app.code.waitAndClick(`div[id = "workbench.view.extension.test"] div.monaco - tree - row: nth - child(${ nodeNumber }) a.label - name: nth - child(1n)`);
// });
// When('I stop the tests', async function () {
//     const selector = 'div[id="workbench.parts.sidebar"] a[title="Stop"]';
//     await context.app.code.waitAndClick(selector);
// });
// Then('stop the tests', async function () {
//     await stopRunningTests();
// });
// export async function killRunningTests() {
//     try {
//         const selector = 'div[id="workbench.parts.sidebar"] a[title="Stop"]';
//         await context.app.code.waitForElement(selector, undefined, 1, 100);
//     } catch {
//         return;
//     }
//     try {
//         await stopRunningTests();
//     } catch {
//         noop();
//     }
// }
// async function stopRunningTests() {
//     const selector = 'div[id="workbench.parts.sidebar"] a[title="Stop"]';
//     await context.app.code.waitAndClick(selector);
// }
// When('I click first code lens "Run Test"', async function () {
//     const selector = 'div[id="workbench.editors.files.textFileEditor"] span.codelens-decoration:nth-child(2) a:nth-child(1)';
//     const eles = await context.app.code.waitForElements(selector, true);
//     expect(eles[0].textContent).to.contain('Run Test');
//     await context.app.code.waitAndClick(selector);
// });

// When('I click first code lens "Debug Test"', async function () {
//     const selector = 'div[id="workbench.editors.files.textFileEditor"] span.codelens-decoration:nth-child(2) a:nth-child(3)';
//     const eles = await context.app.code.waitForElements(selector, true);
//     expect(eles[0].textContent).to.contain('Debug Test');
//     await context.app.code.waitAndClick(selector);
// });

// When('I click second code lens "Debug Test"', async function () {
//     const selector = 'div[id="workbench.editors.files.textFileEditor"] span.codelens-decoration:nth-child(3) a:nth-child(3)';
//     const eles = await context.app.code.waitForElements(selector, true);
//     expect(eles[0].textContent).to.contain('Debug Test');
//     await context.app.code.waitAndClick(selector);
// });

// When('I click second code lens "Run Test"', async function () {
//     const selector = 'div[id="workbench.editors.files.textFileEditor"] span.codelens-decoration:nth-child(3) a:nth-child(1)';
//     const eles = await context.app.code.waitForElements(selector, true);
//     expect(eles[0].textContent).to.contain('Run Test');
//     await context.app.code.waitAndClick(selector);
// });
