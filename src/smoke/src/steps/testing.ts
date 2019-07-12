// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { Then, When } from 'cucumber';
import { context } from '../application';
import { CucumberRetryMax20Seconds, CucumberRetryMax2Seconds, CucumberRetryMax5Seconds } from '../constants';

type TestNodeStatus = 'Unknown' | 'Success' | 'Progress' | 'Skip' | 'Ok' | 'Pass' | 'Fail' | 'Error';
const statusToIconMapping: Record<TestNodeStatus, string> = {
    Unknown: 'status-unknown.svg',
    Skip: 'status-unknown.svg',
    Progress: 'discovering-tests.svg',
    Ok: 'status-ok.svg',
    Pass: 'status-ok.svg',
    Success: 'status-ok.svg',
    Fail: 'status-error.svg',
    Error: 'status-error.svg'
};

Then('the test explorer icon will be visible', async () => {
    await context.app.workbench.testExplorer.waitUntilIconVisible();
});

// Surely tests can't take more than 30s to get discovered.
When('I wait for test discovery to complete', async () => {
    await context.app.workbench.testExplorer.waitForTestsToStop();
});

// Surely pythonn tests (in our UI Tests) can't take more than 30s to run.
When('I wait for tests to complete running', async () => {
    await context.app.workbench.testExplorer.waitForTestsToStop();
});

Then('there are {int} nodes in the test explorer', CucumberRetryMax5Seconds, async (expectedCount: number) => {
    const count = await context.app.workbench.testExplorer.getNodeCount();
    expect(count).to.equal(expectedCount);
});
Then('all of the test tree nodes have a progress icon', CucumberRetryMax5Seconds, async () => {
    const elements = await context.app.workbench.testExplorer.getNodeIcons();
    const progressIconCount = elements.filter(ele => ele.attributes.style.includes('discovering-tests.svg'));
    expect(progressIconCount.length).to.equal(elements.length);
});
async function getNumberOfNodesWithIcon(icon: string): Promise<number> {
    const elements = await context.app.workbench.testExplorer.getNodeIcons();
    return elements.filter(ele => ele.attributes.style.includes(icon)).length;
}
Then('{int} nodes in the test explorer have a status of "{word}"', CucumberRetryMax5Seconds, async (count: number, status: TestNodeStatus) => {
    const nodeCount = await getNumberOfNodesWithIcon(statusToIconMapping[status]);
    expect(nodeCount).to.equal(count);
});
Then('1 node in the test explorer has a status of "{word}"', CucumberRetryMax5Seconds, async (status: TestNodeStatus) => {
    const nodeCount = await getNumberOfNodesWithIcon(statusToIconMapping[status]);
    expect(nodeCount).to.equal(1);
});
Then('the node {string} in the test explorer has a status of "{word}"', CucumberRetryMax5Seconds, async (label: string, status: TestNodeStatus) => {
    const number = await context.app.workbench.testExplorer.getNodeNumber(label);
    const icon = await context.app.workbench.testExplorer.getNodeIcon(number);
    expect(icon.attributes.style).to.include(statusToIconMapping[status]);
});

Then('the stop icon is visible in the toolbar', async () => {
    await context.app.workbench.testExplorer.waitForToolbarIconToBeVisible('Stop');
});
Then('the run failed tests icon is visible in the toolbar', async () => {
    await context.app.workbench.testExplorer.waitForToolbarIconToBeVisible('Run Failed Tests');
});
Then('I stop discovering tests', async () => {
    await context.app.workbench.testExplorer.clickToolbarIcon('Stop');
});
When('I stop running tests', async () => {
    await context.app.workbench.testExplorer.clickToolbarIcon('Stop');
});
When('I run failed tests', async () => {
    await context.app.workbench.testExplorer.clickToolbarIcon('Run Failed Tests');
});

Then('the stop icon is not visible in the toolbar', CucumberRetryMax2Seconds, async () => {
    await context.app.workbench.testExplorer.waitForToolbarIconToBeInvisible('Stop');
});
When('I click the test node with the label {string}', async (label: string) => {
    const number = await context.app.workbench.testExplorer.getNodeNumber(label);
    await context.app.workbench.testExplorer.clickNode(number);
});
When('I navigate to the code associated with the test node {string}', async (label: string) => {
    await context.app.workbench.testExplorer.selectActionForNode(label, 'open');
});
// tslint:disable: no-invalid-this no-any restrict-plus-operands no-console
When('I debug the node {string} from the test explorer', CucumberRetryMax20Seconds, async function (this: any, label: string) {
    const counter = this.retryCounter = ((this.retryCounter || 0) + 1);
    console.log(`Start debugging node, counter ${counter}`);
    await context.app.workbench.testExplorer.selectActionForNode(label, 'debug', counter * 2);
    console.log(`Clicked debug ${counter}`);
    await context.app.code.waitForElement('div.debug-toolbar', ele => ele ? !ele.attributes.style.includes('[aria-hidden="true"]') : false, 50);
    console.log(`Debugger started ${counter}`);
});
When('I run the node {string} from the test explorer', async (label: string) => {
    await context.app.workbench.testExplorer.selectActionForNode(label, 'run');
});

// Given('the test framework is {word}', async (testFramework: string) => {
//     await updateSetting('python.unitTest.nosetestsEnabled', testFramework === 'nose', context.app.workspacePathOrFolder);
//     await updateSetting('python.unitTest.pyTestEnabled', testFramework === 'pytest', context.app.workspacePathOrFolder);
//     await updateSetting('python.unitTest.unittestEnabled', testFramework === 'unittest', context.app.workspacePathOrFolder);
// });
// Then('wait for the test icon to appear within {int} seconds', async (timeout: number) => {
//     const icon = '.part.activitybar.left .composite-bar li a[title="Test"]';
//     await context.app.code.waitForElement(icon, undefined, timeout * 1000 / 250, 250);
//     await sleep(250);
// });
// Then('wait for the toolbar button with the text {string} to appear within {int} seconds', async (title: string, timeout: number) => {
//     const button = `div[id = "workbench.parts.sidebar"] a[title = "${title}"]`;
//     await context.app.code.waitForElement(button, undefined, timeout * 1000 / 250, 250);
//     await sleep(1000);
// Then('the toolbar button with the text {string} is visible', async (title: string) => {
// });
//     await context.app.code.waitForElement(`div[id = "workbench.parts.sidebar"] a[title = "${title}"]`);
// });
// Then('the toolbar button with the text {string} is not visible', async (title: string) => {
//     const eles = await context.app.code.waitForElements('div[id="workbench.parts.sidebar"] ul[aria-label="PYTHON actions"] li a', true);
//     assert.equal(eles.find(ele => ele.attributes['title'] === title), undefined);
// });
// Then('select first node', async () => {
//     // await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.has-children:nth-child(1) a.label-name:nth-child(1n)');
//     await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.monaco-tree-row:nth-child(1) a.label-name:nth-child(1n)');
// });
// Then('select second node', async () => {
//     // await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.has-children:nth-child(2) a.label-name:nth-child(1n)');
//     await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.monaco-tree-row:nth-child(2) a.label-name:nth-child(1n)');
// });
// Then('has {int} error test items', async (count: number) => {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="status-error.svg"]', true);
//     assert.equal(eles.length, count);
// });
// Then('there are at least {int} error test items', async (count: number) => {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="status-error.svg"]', true);
//     expect(eles).to.be.lengthOf.greaterThan(count - 1);
// });
// Then('there are at least {int} error test items', async (count: number) => {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="status-error.svg"]', true);
//     expect(eles).to.be.lengthOf.greaterThan(count - 1);
// });
// Then('there are {int} success test items', async (count: number) => {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="status-ok.svg"]', true);
//     assert.equal(eles.length, count);
// });
// Then('there are {int} running test items', async (count: number) => {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="discovering-tests.svg"]', true);
//     assert.equal(eles.length, count);
// });
// Then('there are at least {int} running test items', async (count: number) => {
//     const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.custom-view-tree-node-item-icon[style^="background-image:"][style*="discovering-tests.svg"]', true);
//     expect(eles).to.be.lengthOf.greaterThan(count - 1);
// });
// When('I select test tree node number {int} and press run', async (nodeNumber: number) => {
//     await highlightNode(nodeNumber);
//     const selector = `div.monaco - tree - row: nth - child(${ nodeNumber }) div.monaco - icon - label.custom - view - tree - node - item - resourceLabel > div.actions > div > ul a[title = "Run"]`;
//     await context.app.code.waitAndClick(selector);
// });
// When('I select test tree node number {int} and press open', async (nodeNumber: number) => {
//     await highlightNode(nodeNumber);
//     const selector = `div.monaco - tree - row: nth - child(${ nodeNumber }) div.monaco - icon - label.custom - view - tree - node - item - resourceLabel a[title = "Open"]`;
//     await context.app.code.waitAndClick(selector);
// });
// When('I select test tree node number {int} and press debug', async (nodeNumber: number) => {
//     await highlightNode(nodeNumber);
//     const selector = `div.monaco - tree - row: nth - child(${ nodeNumber }) div.monaco - icon - label.custom - view - tree - node - item - resourceLabel a[title = "Debug"]`;
//     await context.app.code.waitAndClick(selector);
// });
// When('I select test tree node number {int}', async (nodeNumber: number) => {
//     await highlightNode(nodeNumber);
//     await context.app.code.waitAndClick(`div[id = "workbench.view.extension.test"] div.monaco - tree - row: nth - child(${ nodeNumber }) a.label - name: nth - child(1n)`);
// });
// When('I stop the tests', async () => {
//     const selector = 'div[id="workbench.parts.sidebar"] a[title="Stop"]';
//     await context.app.code.waitAndClick(selector);
// });
// Then('stop the tests', async () => {
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
// When('I click first code lens "Run Test"', async () => {
//     const selector = 'div[id="workbench.editors.files.textFileEditor"] span.codelens-decoration:nth-child(2) a:nth-child(1)';
//     const eles = await context.app.code.waitForElements(selector, true);
//     expect(eles[0].textContent).to.contain('Run Test');
//     await context.app.code.waitAndClick(selector);
// });

// When('I click first code lens "Debug Test"', async () => {
//     const selector = 'div[id="workbench.editors.files.textFileEditor"] span.codelens-decoration:nth-child(2) a:nth-child(3)';
//     const eles = await context.app.code.waitForElements(selector, true);
//     expect(eles[0].textContent).to.contain('Debug Test');
//     await context.app.code.waitAndClick(selector);
// });

// When('I click second code lens "Debug Test"', async () => {
//     const selector = 'div[id="workbench.editors.files.textFileEditor"] span.codelens-decoration:nth-child(3) a:nth-child(3)';
//     const eles = await context.app.code.waitForElements(selector, true);
//     expect(eles[0].textContent).to.contain('Debug Test');
//     await context.app.code.waitAndClick(selector);
// });

// When('I click second code lens "Run Test"', async () => {
//     const selector = 'div[id="workbench.editors.files.textFileEditor"] span.codelens-decoration:nth-child(3) a:nth-child(1)';
//     const eles = await context.app.code.waitForElements(selector, true);
//     expect(eles[0].textContent).to.contain('Run Test');
//     await context.app.code.waitAndClick(selector);
// });

// Then('do it', async () => {
//     // const eles = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] div.content.custom-view-tree-node-item a.label-name', true);
//     await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.has-children:nth-child(2n) a.label-name:nth-child(1n)');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('right');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('right');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('right');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('right');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('down');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('down');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('down');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('down');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('right');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('down');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('down');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('down');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('down');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('right');
//     await sleep(100);
//     await context.app.code.dispatchKeybinding('right');
//     await sleep(100);
//     // await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.has-children:nth-child(2n) div.content > div:first-child');
//     // await sleep(100);
//     // await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.has-children:nth-child(2n) div.content');
//     // await sleep(100);
//     // await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.has-children:nth-child(2n)');
//     // await sleep(100);
//     // await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.has-children:nth-child(3n) div.content > div:first-child');
//     // const ele = eles[0];
//     // ele.
// });
When('I expand all of the nodes in the test explorer', async () => {
    await context.app.workbench.testExplorer.expandAllNodes();
});
