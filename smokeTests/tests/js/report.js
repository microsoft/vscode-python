var reporter = require('cucumber-html-reporter');

var options = {
    theme: 'bootstrap',
    jsonFile: '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/.vscode-test/reports/report.json',
    output: '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/.vscode-test/reports/report.html',
    reportSuiteAsScenarios: true,
    launchReport: true,
    metadata: {
        "App Version": "0.3.2",
        "Test Environment": "STAGING",
        "Browser": "Chrome  54.0.2840.98",
        "Platform": "Windows 10",
        "Parallel": "Scenarios",
        "Executed": "Remote"
    }
};

reporter.generate(options);
