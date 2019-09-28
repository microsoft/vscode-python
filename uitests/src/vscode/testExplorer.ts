// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { RetryMax10Seconds } from '../constants';
import { retry, sleep } from '../helpers';
import '../helpers/extensions';
import { Selector } from '../selectors';
import { IApplication, ITestExplorer, TestExplorerNodeStatus, TestExplorerToolbarIcon, TestingAction } from '../types';

const statusToIconMapping: Map<TestExplorerNodeStatus, string> = new Map([
    ['Unknown', 'status-unknown.svg'],
    ['Progress', 'discovering-tests.svg'],
    ['Ok', 'status-ok.svg'],
    ['Pass', 'status-ok.svg'],
    ['Success', 'status-ok.svg'],
    ['Fail', 'status-error.svg'],
    ['Error', 'status-error.svg']
]);
// 100ms was too low in version 1.38 of VS Code.
const delayForUIToUpdate = 150;
const iconTitleMapping: Record<TestExplorerToolbarIcon, string> = {
    Stop: 'Stop',
    RunFailedTests: 'Run Failed Tests'
};

const maxNodesToExpand = 50;
type NodeInfo = {
    expanded: boolean;
    hasChildren: boolean;
    focused: boolean;
    index: number;
    status: TestExplorerNodeStatus;
    label: string;
};

export class TestExplorer implements ITestExplorer {
    constructor(private readonly app: IApplication) {}
    public async isOpened(): Promise<boolean> {
        return this.app.driver
            .$(this.app.getCSSSelector(Selector.TestActivityBar))
            .then(() => true)
            .catch(() => false);
    }
    public async isIconVisible(): Promise<boolean> {
        return this.app.driver
            .$(this.app.getCSSSelector(Selector.TestActivityIcon))
            .then(() => true)
            .catch(() => false);
    }
    public async waitUntilOpened(timeout: number = 3000): Promise<void> {
        await this.app.driver.waitForSelector(this.app.getCSSSelector(Selector.TestActivityBar), {
            timeout,
            visible: true
        });
    }
    public async waitUntilIconVisible(timeout: number = 3000): Promise<void> {
        await this.app.driver.waitForSelector(this.app.getCSSSelector(Selector.TestActivityIcon), {
            timeout,
            visible: true
        });
    }
    public async waitUntilTestsStop(timeout: number): Promise<void> {
        await this.app.driver.waitForSelector(this.app.getCSSSelector(Selector.TestExplorerToolbarcon).format(iconTitleMapping.Stop), { timeout, hidden: true });
    }
    public async expandNodes(maxNodes: number = maxNodesToExpand): Promise<void> {
        await this.ensureOpened();
        // We only want to support <= 15 nodes in testing.
        const initialNodeCount = await this.getNodeCount();
        if (initialNodeCount === 0) {
            return;
        }
        // wait at least 1s before selecting nodes and expanding.
        // Its possible the UI is not yet ready.
        await sleep(1500);
        await this.selectFirstNode();
        try {
            let nodeNumber = 0;
            while (nodeNumber < maxNodes) {
                nodeNumber += 1;
                const visibleNodes = await this.getNodeCount();
                let info: { expanded: boolean; hasChildren: boolean; focused: boolean };
                try {
                    info = await this.getNodeInfo({ nodeNumber });
                } catch {
                    return;
                }
                if (!info.hasChildren && nodeNumber > visibleNodes) {
                    return;
                }
                if (nodeNumber === 1 && info.expanded && info.hasChildren) {
                    await this.app.driver.press('ArrowDown');
                    await sleep(delayForUIToUpdate);
                    continue;
                }
                if (!info.expanded && info.hasChildren) {
                    await this.app.driver.press('ArrowRight');
                    await sleep(delayForUIToUpdate);
                    await this.app.driver.press('ArrowDown');
                    await sleep(delayForUIToUpdate);
                    continue;
                }
                if (!info.hasChildren) {
                    await this.app.driver.press('ArrowDown');
                    await sleep(delayForUIToUpdate);
                    continue;
                }
            }
        } finally {
            const visibleNodes = await this.getNodeCount();
            if (visibleNodes === initialNodeCount) {
                // Something is wrong, try again.
                // tslint:disable-next-line: no-unsafe-finally
                throw new Error('Retry expanding nodes. First iteration did not reveal any new nodes!');
            }
        }
    }
    public async getNodeCount(_maxNodes?: number | undefined): Promise<number> {
        await this.ensureOpened();
        const elements = await this.app.driver.$$(this.app.getCSSSelector(Selector.TestExplorerNode));
        return elements.length;
    }
    public async selectNode(label: string): Promise<void> {
        await this.ensureOpened();
        if ((await this.getNodeCount()) === 0) {
            throw new Error('No nodes to select');
        }

        await this.selectNodeNumber(await this.getNodeNumber(label));
    }
    public async clickNode(label: string): Promise<void> {
        await this.ensureOpened();
        const nodeNumber = await this.getNodeNumber(label);
        // await this.selectNodeNumber(nodeNumber);
        // await this.app.driver.click(`div[id="workbench.view.extension.test"] div.monaco-tree-row:nth-child(${nodeNumber})`);
        await this.selectNodeNumber(nodeNumber);
        await this.app.driver.press('Enter');
    }
    public async waitUntilToolbarIconVisible(icon: TestExplorerToolbarIcon, timeout: number = 30_000): Promise<void> {
        await this.ensureOpened();
        const selector = this.app.getCSSSelector(Selector.TestExplorerToolbarcon).format(iconTitleMapping[icon]);
        await this.app.driver.waitForSelector(selector, { timeout, visible: true });
    }
    public async waitUntilToolbarIconHidden(icon: TestExplorerToolbarIcon, timeout: number = 30_000): Promise<void> {
        await this.ensureOpened();
        const selector = this.app.getCSSSelector(Selector.TestExplorerToolbarcon).format(iconTitleMapping[icon]);
        await this.app.driver.waitForSelector(selector, { timeout, hidden: true });
    }
    public async clickToolbarIcon(icon: TestExplorerToolbarIcon): Promise<void> {
        await this.ensureOpened();
        const selector = this.app.getCSSSelector(Selector.TestExplorerToolbarcon).format(iconTitleMapping[icon]);
        await this.app.driver.click(selector);
    }
    public async getNodes(): Promise<{ label: string; index: number; status: TestExplorerNodeStatus }[]> {
        const nodeCount = await this.getNodeCount();
        // tslint:disable-next-line: prefer-array-literal
        const indices = [...new Array(nodeCount).keys()];
        return Promise.all(indices.map(index => this.getNodeInfo({ nodeNumber: index + 1 })));
    }
    public async getNode(label: string): Promise<{ label: string; index: number; status: TestExplorerNodeStatus }> {
        return this.getNodeInfo({ label });
    }
    public async selectActionForNode(label: string, action: TestingAction): Promise<void> {
        await this.ensureOpened();
        // First select the node to highlight the icons.
        await this.selectNode(label);
        const node = await this.getSelectedNode();
        if (!node) {
            throw new Error(`Node with the label '${label}' not selected`);
        }
        // For some reason this doesn't work on CI.
        // Instead just select the icon by tabbing to it and hit the `Enter` key.
        // This way, the icon is displayed (similar to when you hover over the icon before clicking it).
        // We could probably use `hoever` to ensure the icon is visible, however tabbing works.
        // const selector = nodeActionSelector.format(node.number.toString(), actionTitleMapping[action]);
        // await context.app.code.waitAndClick(selector, 2, 2);

        const tabCounter = action === 'run' ? 1 : action === 'debug' ? 2 : 3;
        for (let counter = 0; counter < tabCounter; counter += 1) {
            await this.app.driver.press('tab');
            await sleep(delayForUIToUpdate);
        }
        await this.app.driver.press('Enter');
        await sleep(delayForUIToUpdate);
    }
    public async getNodeNumber(label: string): Promise<number> {
        await this.ensureOpened();
        if ((await this.getNodeCount()) === 0) {
            throw new Error('There are no nodes');
        }
        // Walk through each node and check the label.
        for (let nodeNumber = 1; nodeNumber < maxNodesToExpand; nodeNumber += 1) {
            const nodeLabel = await this.getNodeLabel(nodeNumber);
            if (
                nodeLabel
                    .normalize()
                    .trim()
                    .toLowerCase()
                    .includes(label.toLowerCase())
            ) {
                return nodeNumber;
            }
        }

        throw new Error(`Unable to find node named '${label}'`);
    }
    @retry(RetryMax10Seconds)
    private async selectNodeNumber(nodeNumber: number): Promise<void> {
        await this.ensureOpened();
        // We only want to support <= 15 nodes in testing.
        if ((await this.getNodeCount()) === 0) {
            return;
        }
        await this.selectFirstNode();
        for (let i = 1; i < maxNodesToExpand; i += 1) {
            if (i === nodeNumber) {
                return;
            }
            const visibleNodes = await this.getNodeCount();
            let info: { expanded: boolean; hasChildren: boolean };
            try {
                info = await this.getNodeInfo({ nodeNumber: i });
            } catch {
                return;
            }
            if (!info.hasChildren && i > visibleNodes) {
                return;
            }
            if (i === 1 && info.expanded && info.hasChildren) {
                await this.app.driver.press('ArrowDown');
                await sleep(delayForUIToUpdate);
                continue;
            }
            if (!info.expanded && info.hasChildren) {
                await this.app.driver.press('ArrowRight');
                await sleep(delayForUIToUpdate);
                await this.app.driver.press('ArrowDown');
                await sleep(delayForUIToUpdate);
                continue;
            }
            await this.app.driver.press('ArrowDown');
            await sleep(delayForUIToUpdate);
        }
    }
    private async getNodeInfo(options: { label: string } | { nodeNumber: number } | { label: string; nodeNumber: number }): Promise<NodeInfo> {
        let label = '';
        let nodeNumber = -1;
        if ('nodeNumber' in options) {
            nodeNumber = options.nodeNumber;
        }
        if ('label' in options) {
            label = options.label;
        }
        if (nodeNumber === -1) {
            nodeNumber = await this.getNodeNumber(label);
        }

        const iconSelector = this.app.getCSSSelector(Selector.NthTestExplorerNodeIcon).format(nodeNumber.toString());
        const selector = this.app.getCSSSelector(Selector.NthTestExplorerNode).format(nodeNumber.toString());

        const [bgIcon, nodeLabel, className, ariaExpandedAttrValue] = await Promise.all([
            this.app.driver.$eval(iconSelector, element => getComputedStyle(element).backgroundImage || ''),
            label ? Promise.resolve(label) : this.getNodeLabel(nodeNumber),
            this.app.driver.$eval(selector, element => element.className),
            this.app.driver.$eval(selector, element => element.getAttribute('aria-expanded') || '')
        ]);

        const status = Array.from(statusToIconMapping.entries()).reduce<TestExplorerNodeStatus>((currentStatus, item) => {
            if (bgIcon.includes(item[1])) {
                return item[0];
            }
            return currentStatus;
        }, 'Unknown');

        return {
            expanded: ariaExpandedAttrValue === 'true',
            focused: className.indexOf('focused') >= 0,
            hasChildren: ariaExpandedAttrValue !== '',
            status,
            index: nodeNumber - 1,
            label: nodeLabel
        };
    }
    private async getNodeLabel(nodeNumber: number): Promise<string> {
        const selector = this.app.getCSSSelector(Selector.NthTestExplorerNodeLabel).format(nodeNumber.toString());
        return this.app.driver.$eval(selector, element => element.textContent || '').then(text => text.normalize());
    }
    private async getSelectedNode(): Promise<NodeInfo | undefined> {
        if ((await this.getNodeCount()) === 0) {
            return;
        }
        for (let nodeNumber = 1; nodeNumber < maxNodesToExpand; nodeNumber += 1) {
            const info = await this.getNodeInfo({ nodeNumber });
            if (info.focused) {
                return info;
            }
        }
    }
    private async selectFirstNode() {
        await this.app.driver.click(this.app.getCSSSelector(Selector.TestExplorerTreeViewContainer));
        await sleep(delayForUIToUpdate);
        await this.app.driver.press('ArrowDown');
        await sleep(delayForUIToUpdate);
    }
    private async ensureOpened(): Promise<void> {
        if (await this.isOpened()) {
            return;
        }
        await this.app.quickopen.runCommand('View: Show Test');
        await this.waitUntilOpened();
    }
}
