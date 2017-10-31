'use strict';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';
import { createDeferred, isNotInstalledError } from '../../common/helpers';
import { CANCELLATION_REASON } from '../common/constants';
import { displayTestErrorMessage } from '../common/testUtils';
import { Tests } from '../common/types';

export class TestResultDisplay {
    private statusBar: vscode.StatusBarItem;
    private discoverCounter = 0;
    private ticker = ['|', '/', '-', '|', '/', '-', '\\'];
    private progressTimeout;
    private progressPrefix: string;
    // tslint:disable-next-line:no-any
    constructor(private outputChannel: vscode.OutputChannel, private onDidChange: vscode.EventEmitter<any> = null) {
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }
    public dispose() {
        this.statusBar.dispose();
    }
    public set enabled(enable: boolean) {
        if (enable) {
            this.statusBar.show();
        } else {
            this.statusBar.hide();
        }
    }
    public displayProgressStatus(testRunResult: Promise<Tests>, debug: boolean = false) {
        this.displayProgress('Running Tests', 'Running Tests (Click to Stop)', constants.Commands.Tests_Ask_To_Stop_Test);
        testRunResult
            .then(tests => this.updateTestRunWithSuccess(tests, debug))
            .catch(this.updateTestRunWithFailure.bind(this))
            // We don't care about any other exceptions returned by updateTestRunWithFailure
            // tslint:disable-next-line:no-empty
            .catch(() => { });
    }
    public displayDiscoverStatus(testDiscovery: Promise<Tests>) {
        this.displayProgress('Discovering Tests', 'Discovering Tests (Click to Stop)', constants.Commands.Tests_Ask_To_Stop_Discovery);
        return testDiscovery.then(tests => {
            this.updateWithDiscoverSuccess(tests);
            return tests;
        }).catch(reason => {
            this.updateWithDiscoverFailure(reason);
            return Promise.reject(reason);
        });
    }

    private updateTestRunWithSuccess(tests: Tests, debug: boolean = false): Tests {
        this.clearProgressTicker();

        // Treat errors as a special case, as we generally wouldn't have any errors
        const statusText = [];
        const toolTip = [];
        let foreColor = '';

        if (tests.summary.passed > 0) {
            statusText.push(`${constants.Octicons.Test_Pass} ${tests.summary.passed}`);
            toolTip.push(`${tests.summary.passed} Passed`);
            foreColor = '#66ff66';
        }
        if (tests.summary.skipped > 0) {
            statusText.push(`${constants.Octicons.Test_Skip} ${tests.summary.skipped}`);
            toolTip.push(`${tests.summary.skipped} Skipped`);
            foreColor = '#66ff66';
        }
        if (tests.summary.failures > 0) {
            statusText.push(`${constants.Octicons.Test_Fail} ${tests.summary.failures}`);
            toolTip.push(`${tests.summary.failures} Failed`);
            foreColor = 'yellow';
        }
        if (tests.summary.errors > 0) {
            statusText.push(`${constants.Octicons.Test_Error} ${tests.summary.errors}`);
            toolTip.push(`${tests.summary.errors} Error${tests.summary.errors > 1 ? 's' : ''}`);
            foreColor = 'yellow';
        }
        this.statusBar.tooltip = toolTip.length === 0 ? 'No Tests Ran' : `${toolTip.join(', ')} (Tests)`;
        this.statusBar.text = statusText.length === 0 ? 'No Tests Ran' : statusText.join(' ');
        this.statusBar.color = foreColor;
        this.statusBar.command = constants.Commands.Tests_View_UI;
        if (this.onDidChange) {
            this.onDidChange.fire();
        }
        if (statusText.length === 0 && !debug) {
            vscode.window.showWarningMessage('No tests ran, please check the configuration settings for the tests.');
        }
        return tests;
    }

    // tslint:disable-next-line:no-any
    private updateTestRunWithFailure(reason: any): Promise<any> {
        this.clearProgressTicker();
        this.statusBar.command = constants.Commands.Tests_View_UI;
        if (reason === CANCELLATION_REASON) {
            this.statusBar.text = '$(zap) Run Tests';
            this.statusBar.tooltip = 'Run Tests';
        } else {
            this.statusBar.text = '$(alert) Tests Failed';
            this.statusBar.tooltip = 'Running Tests Failed';
            displayTestErrorMessage('There was an error in running the tests.');
        }
        return Promise.reject(reason);
    }

    private displayProgress(message: string, tooltip: string, command: string) {
        this.progressPrefix = this.statusBar.text = `$(stop) ${message}`;
        this.statusBar.command = command;
        this.statusBar.tooltip = tooltip;
        this.statusBar.show();
        this.clearProgressTicker();
        this.progressTimeout = setInterval(() => this.updateProgressTicker(), 150);
    }
    private updateProgressTicker() {
        const text = `${this.progressPrefix} ${this.ticker[this.discoverCounter % 7]}`;
        this.discoverCounter += 1;
        this.statusBar.text = text;
    }
    private clearProgressTicker() {
        if (this.progressTimeout) {
            clearInterval(this.progressTimeout);
        }
        this.progressTimeout = null;
        this.discoverCounter = 0;
    }

    // tslint:disable-next-line:no-any
    private disableTests(): Promise<any> {
        // tslint:disable-next-line:no-any
        const def = createDeferred<any>();
        const pythonConfig = vscode.workspace.getConfiguration('python');
        const settingsToDisable = ['unitTest.promptToConfigure', 'unitTest.pyTestEnabled',
            'unitTest.unittestEnabled', 'unitTest.nosetestsEnabled'];

        function disableTest() {
            if (settingsToDisable.length === 0) {
                return def.resolve();
            }
            pythonConfig.update(settingsToDisable.shift(), false)
                .then(disableTest.bind(this), disableTest.bind(this));
        }

        disableTest();
        return def.promise;
    }

    private updateWithDiscoverSuccess(tests: Tests) {
        this.clearProgressTicker();
        const haveTests = tests && (tests.testFunctions.length > 0);
        this.statusBar.text = '$(zap) Run Tests';
        this.statusBar.tooltip = 'Run Tests';
        this.statusBar.command = constants.Commands.Tests_View_UI;
        this.statusBar.show();
        if (this.onDidChange) {
            this.onDidChange.fire();
        }

        if (!haveTests) {
            vscode.window.showInformationMessage('No tests discovered, please check the configuration settings for the tests.', 'Disable Tests').then(item => {
                if (item === 'Disable Tests') {
                    // tslint:disable-next-line:no-floating-promises
                    this.disableTests();
                }
            });
        }
    }

    // tslint:disable-next-line:no-any
    private updateWithDiscoverFailure(reason: any) {
        this.clearProgressTicker();
        this.statusBar.text = '$(zap) Discover Tests';
        this.statusBar.tooltip = 'Discover Tests';
        this.statusBar.command = constants.Commands.Tests_Discover;
        this.statusBar.show();
        this.statusBar.color = 'yellow';
        if (reason !== CANCELLATION_REASON) {
            this.statusBar.text = '$(alert) Test discovery failed';
            this.statusBar.tooltip = 'Discovering Tests failed (view \'Python Test Log\' output panel for details)';
            // TODO: ignore this quitemode, always display the error message (inform the user).
            if (!isNotInstalledError(reason)) {
                // TODO: show an option that will invoke a command 'python.test.configureTest' or similar.
                // This will be hanlded by main.ts that will capture input from user and configure the tests.
                vscode.window.showErrorMessage('There was an error in discovering tests, please check the configuration settings for the tests.');
            }
        }
    }
}
