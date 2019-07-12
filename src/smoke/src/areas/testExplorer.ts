// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { IElement } from '../../../../out/smoke/vscode/vscode/driver';
import { context } from '../application';
import { RetryMax20Seconds, RetryMax5Seconds } from '../constants';
import { retry, sleep } from '../helpers';
import '../helpers/extensions';

const testExplorerSelector = 'div[id="workbench.view.extension.test"]';
const testActivityBarIconSelector = '.activitybar.left .actions-container a[title=\'Test\']';
const stopIcon = 'div[id=\'workbench.parts.sidebar\'] .action-item a[title=\'Stop\']';
const delayForUIToUpdate = 100;
const nodeLabelSelector = 'div[id="workbench.view.extension.test"] div.monaco-tree-row:nth-child({0}) a.label-name';
const nodeActionSelector = 'div[id="workbench.view.extension.test"] div.monaco-tree-row:nth-child({0}) a.action-label.icon[title="{1}"]';
type Action = 'run' | 'debug' | 'open';
const actionTitleMapping: Record<Action, string> = {
    run: 'Run',
    debug: 'Debug',
    open: 'Open'
};
type ToolbarIcon = 'Stop' | 'Run Failed Tests';
const iconTitleMapping: Record<ToolbarIcon, string> = {
    Stop: 'Stop',
    'Run Failed Tests': 'Run Failed Tests'
};

const maxNodes = 50;

type NodeInfo = { expanded: boolean; hasChildren: boolean; focused: boolean; number: number };

export class TestExplorer {
    public async isIconVisible() {
        try {
            await context.app.code.waitForElement(testActivityBarIconSelector, undefined, 2);
            return true;
        } catch {
            return false;
        }
    }
    public async isVisible() {
        try {
            await context.app.code.waitForElement(testExplorerSelector, undefined, 2);
            return true;
        } catch {
            return false;
        }
    }
    @retry(RetryMax5Seconds)
    public async waitUntilIconVisible() {
        const visible = await this.isIconVisible();
        assert.ok(visible);
    }
    @retry(RetryMax5Seconds)
    public async waitUntilVisible() {
        const visible = await this.isVisible();
        assert.ok(visible);
    }
    @retry(RetryMax20Seconds)
    public async waitForTestsToStop() {
        // Wait for test discovery to start (wait for icon to appear).
        await sleep(2000);
        // Wait for a max of 10 seconds for test discovery to complete.
        await context.app.code.waitForElementToBeHidden(stopIcon, undefined, 10, 1000);
    }
    public async selectActionForNode(label: string, action: Action): Promise<void> {
        // First select the node to highlight the icons.
        await this.selectNodeByLabel(label);
        const node = await this.getSelectedNode();
        if (!node) {
            throw new Error(`Node with the label '${label}' not selected`);
        }
        const selector = nodeActionSelector.format(node.number.toString(), actionTitleMapping[action]);
        await context.app.code.waitAndClick(selector, 2, 2);
    }

    /**
     * Expand all nodes (max 5 nodes).
     * Remember to wait a little when navigating through the tree.
     * We need to wait for VSC to update the UI.
     * @returns
     */
    public async expandAllNodes() {
        await this.waitUntilVisible();
        // We only want to support <= 15 nodes in testing.
        if (await this.getNodeCount() === 0) {
            return;
        }
        // wait at least 1s before selecting nodes and expanding.
        // Its possible the UI is not yet ready.
        await sleep(1500);
        await this.selectFirstNode();
        let nodeNumber = 0;
        while (nodeNumber < maxNodes) {
            nodeNumber += 1;
            const visibleNodes = await this.getNodeCount();
            let info: { expanded: boolean; hasChildren: boolean; focused: boolean };
            try {
                info = await this.getNodeInfo(nodeNumber);
            } catch {
                return;
            }
            if (!info.hasChildren && nodeNumber > visibleNodes) {
                return;
            }
            if (nodeNumber === 1 && info.expanded && info.hasChildren) {
                await context.app.code.dispatchKeybinding('down');
                await sleep(delayForUIToUpdate);
                continue;
            }
            if (!info.expanded && info.hasChildren) {
                await context.app.code.dispatchKeybinding('right');
                await sleep(delayForUIToUpdate);
                await context.app.code.dispatchKeybinding('down');
                await sleep(delayForUIToUpdate);
                continue;
            }
            if (!info.hasChildren) {
                await context.app.code.dispatchKeybinding('down');
                await sleep(delayForUIToUpdate);
                continue;
            }
        }
    }
    public async getNodeCount(): Promise<number> {
        const elements = await context.app.code.waitForElements('div[id="workbench.view.extension.test"] .tree-explorer-viewlet-tree-view div.monaco-tree-row', true, undefined);
        return elements.length;
    }

    public async selectNodeByLabel(label: string): Promise<void> {
        if (await this.getNodeCount() === 0) {
            return;
        }
        // Walk through each node and check the label.
        for (let nodeNumber = 1; nodeNumber < maxNodes; nodeNumber += 1) {
            const nodeLabel = await this.getNodeLabel(nodeNumber);
            if (nodeLabel.normalize().trim().toLowerCase() === label.toLowerCase()) {
                return this.selectNode(nodeNumber);
            }
        }

        throw new Error(`Unable to find node named '${label}'`);
    }
    public async getNodeNumber(label: string): Promise<number> {
        if (await this.getNodeCount() === 0) {
            throw new Error('There are no nodes');
        }
        // Walk through each node and check the label.
        for (let nodeNumber = 1; nodeNumber < maxNodes; nodeNumber += 1) {
            const nodeLabel = await this.getNodeLabel(nodeNumber);
            if (nodeLabel.normalize().trim().toLowerCase().includes(label.toLowerCase())) {
                return nodeNumber;
            }
        }

        throw new Error(`Unable to find node named '${label}'`);
    }

    @retry(RetryMax20Seconds)
    public async waitForToolbarIconToBeHidden(icon: ToolbarIcon): Promise<void> {
        const selector = `div[id='workbench.parts.sidebar'] .action-item a[title='${iconTitleMapping[icon]}']`;
        await context.app.code.waitForElementToBeHidden(selector, undefined, 10, 1000);
    }
    @retry(RetryMax20Seconds)
    public async waitForToolbarIconToBeVisible(icon: ToolbarIcon): Promise<void> {
        const selector = `div[id='workbench.parts.sidebar'] .action-item a[title='${iconTitleMapping[icon]}']`;
        await context.app.code.waitForElement(selector);
    }
    @retry(RetryMax20Seconds)
    public async waitForToolbarIconToBeInvisible(icon: ToolbarIcon): Promise<void> {
        const selector = `div[id='workbench.parts.sidebar'] .action-item a[title='${iconTitleMapping[icon]}']`;
        const visible = await context.app.code.waitForElement(selector, (ele) => !!ele, 2)
            .then(ele => !!ele).catch(() => false);
        assert.ok(!visible);
    }
    public async clickToolbarIcon(icon: ToolbarIcon): Promise<void> {
        const selector = `div[id='workbench.parts.sidebar'] .action-item a[title='${iconTitleMapping[icon]}']`;
        await context.app.code.waitAndClick(selector);
    }
    public async getNodeIcons(): Promise<IElement[]> {
        return context.app.code.waitForElements('div[id="workbench.view.extension.test"] .monaco-tree-row .custom-view-tree-node-item-icon', true);
    }
    public async getNodeIcon(nodeNumber: number): Promise<IElement> {
        return context.app.code.waitForElement(`div[id='workbench.view.extension.test'] .monaco-tree-row:nth-child(${nodeNumber}) .custom-view-tree-node-item-icon`);
    }
    public async clickNode(nodeNumber: number): Promise<void> {
        await this.selectNode(nodeNumber);
        await context.app.code.waitAndClick(`div[id="workbench.view.extension.test"] div.monaco-tree-row:nth-child(${nodeNumber})`);
    }
    /**
     * Remember to wait a little when navigating through the tree.
     * We need to wait for VSC to update the UI.
     *
     * @param {number} number
     * @returns {Promise<void>}
     */
    public async selectNode(nodeNumber: number): Promise<void> {
        // We only want to support <= 15 nodes in testing.
        if (await this.getNodeCount() === 0) {
            return;
        }
        await this.selectFirstNode();
        for (let i = 1; i < maxNodes; i += 1) {
            if (i === nodeNumber) {
                return;
            }
            const visibleNodes = await this.getNodeCount();
            let info: { expanded: boolean; hasChildren: boolean };
            try {
                info = await this.getNodeInfo(i);
            } catch {
                return;
            }
            if (!info.hasChildren && i > visibleNodes) {
                return;
            }
            if (i === 1 && info.expanded && info.hasChildren) {
                await context.app.code.dispatchKeybinding('down');
                await sleep(delayForUIToUpdate);
                continue;
            }
            if (!info.expanded && info.hasChildren) {
                await context.app.code.dispatchKeybinding('right');
                await sleep(delayForUIToUpdate);
                await context.app.code.dispatchKeybinding('down');
                await sleep(delayForUIToUpdate);
                continue;
            }
            await context.app.code.dispatchKeybinding('down');
            await sleep(delayForUIToUpdate);
        }
    }
    private async getNodeLabel(nodeNumber: number): Promise<string> {
        const selector = nodeLabelSelector.format(nodeNumber.toString());
        return context.app.code.waitForElement(selector).then(ele => ele.textContent);
    }
    private async getSelectedNode(): Promise<NodeInfo | undefined> {
        if (await this.getNodeCount() === 0) {
            return;
        }
        for (let nodeNumber = 1; nodeNumber < maxNodes; nodeNumber += 1) {
            const info = await this.getNodeInfo(nodeNumber);
            if (info.focused) {
                return info;
            }
        }
    }

    private async selectFirstNode() {
        // await context.app.code.waitAndClick('div[id="workbench.view.extension.test"] div.monaco-tree-row:nth-child(1)');
        // const treeContainerSelector = 'div[id=\'workbench.view.extension.test\'] .monaco-tree-rows';
        const treeContainerSelector = 'div[id=\'workbench.view.extension.test\'] .monaco-tree';
        await context.app.code.waitAndClick(treeContainerSelector);
        await sleep(100);
        await context.app.code.dispatchKeybinding('down');
        await sleep(100);
    }

    private async getNodeInfo(nodeNumber: number): Promise<NodeInfo> {
        const element = await context.app.code.waitForElement(`div[id="workbench.view.extension.test"] div.monaco-tree-row:nth-child(${nodeNumber})`, undefined, 1, 100);
        return {
            expanded: element.className.indexOf('expanded') >= 0,
            focused: element.className.indexOf('focused') >= 0,
            hasChildren: element.className.indexOf('has-children') >= 0,
            number: nodeNumber
        };
    }

    // def expand_nodes(context):
    //     time.sleep(0.1)
    //     start_time = time.time()
    //     while time.time() - start_time < 5:
    //         _expand_nodes(context)
    //         if get_node_count(context) > 1:
    //             return
    //         time.sleep(0.1)
    //     else:
    //         raise TimeoutError("Timeout waiting to expand all nodes")


    // async function expandNodes(){
    //     const rootNode = await getRootNode();
    //     if (rootNode.className.indexOf('has-children')){
    //         context.app.code.dispatchKeybinding('right')
    //     }


    //     tree = uitests.vscode.core.wait_for_element(
    //         context.driver, ".monaco-tree.monaco-tree-instance-2"
    //     )
    //     tree.click()
    //     for i in range(1, 5000):
    //         selector = (
    //             f"div[id='workbench.view.extension.test'] .monaco-tree-row:nth-child({i})"
    //         )
    //         element = context.driver.find_element_by_css_selector(selector)
    //         action = ActionChains(context.driver)
    //         action.context_click(element)
    //         action.perform()
    //         find = lambda ele: "focused" in ele.get_attribute("class")
    //         uitests.vscode.core.wait_for_element(context.driver, selector, find)
    //         css_class = element.get_attribute("class")

    //         if "has-children" in css_class and "expanded" not in css_class:
    //             tree.send_keys(Keys.RIGHT)
    //             find = lambda ele: "expanded" in ele.get_attribute("class")
    //             uitests.vscode.core.wait_for_element(context.driver, selector, find)

    //         try:
    //             selector = f"div[id='workbench.view.extension.test'] .monaco-tree-row:nth-child({i+1})"
    //             element = context.driver.find_element_by_css_selector(selector)
    //         except Exception:
    //             return
    //         }

    // async function getRootNode() {
    //     const selector = 'div[id=\'workbench.view.extension.test\'] .monaco-tree-row:nth-child(1)';
    //     return context.app.code.waitForElement(selector);
    // }
}
