// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';

suite('Configure Tests Command Activation', () => {
    test('onCommand:python.configureTests should be included in activation events', () => {
        // Read package.json from the project root
        const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Verify that the activation events include the command
        const activationEvents = packageJson.activationEvents;
        expect(activationEvents).to.include('onCommand:python.configureTests');
    });

    test('python.configureTests command should be declared in contributes.commands', () => {
        // Read package.json from the project root
        const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Verify that the command is declared in contributes.commands
        const commands = packageJson.contributes.commands;
        const configureTestsCommand = commands.find((cmd: any) => cmd.command === 'python.configureTests');
        expect(configureTestsCommand).to.not.be.undefined;
        expect(configureTestsCommand.category).to.equal('Python');
    });

    test('Both configureTests and copilotSetupTests commands should have activation events', () => {
        // Read package.json from the project root
        const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Verify both test-related commands have activation events
        const activationEvents = packageJson.activationEvents;
        expect(activationEvents).to.include('onCommand:python.configureTests');
        expect(activationEvents).to.include('onCommand:python.copilotSetupTests');
    });
});