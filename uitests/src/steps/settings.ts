// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import * as assert from 'assert';
import { Given, Then, When } from 'cucumber';
import { ConfigurationTarget } from '../types';

const translateType = (type: SettingType) => (type === 'user' ? ConfigurationTarget.Global : ConfigurationTarget.WorkspaceFolder);
type SettingType = 'user' | 'workspaceFolder' | 'workspace';
type EnabledOrDisabled = 'enabled' | 'disabled';
type EnabledOrDisabledOrRemove = 'enable' | 'disable' | 'remove';

Given('the {word} setting {string} is {word}', async function(type: SettingType, setting: string, enabledOrDisabled: EnabledOrDisabled) {
    await this.app.settings.updateSetting(setting, enabledOrDisabled === 'enabled', translateType(type));
});
Given('the {word} setting {string} has the value {string}', async function(type: SettingType, setting: string, value: string) {
    await this.app.settings.updateSetting(setting, value, translateType(type));
});
Given('the {word} setting {string} has the value {int}', async function(type: SettingType, setting: string, value: number) {
    await this.app.settings.updateSetting(setting, value, translateType(type));
});
Given('the {word} setting {string} does not exist', async function(type: SettingType, setting: string) {
    await this.app.settings.updateSetting(setting, void 0, translateType(type));
});

When('I {word} the {word} setting {string}', async function(change: EnabledOrDisabledOrRemove, type: SettingType, setting: string) {
    const newValue = change === 'remove' ? void 0 : change === 'enable';
    await this.app.settings.updateSetting(setting, newValue, translateType(type));
});

When('I update the {word} setting {string} with the value {string}', async function(type: SettingType, setting: string, value: string) {
    await this.app.settings.updateSetting(setting, value, translateType(type));
});
When('I update the {word} setting {string} with the value {int}', async function(type: SettingType, setting: string, value: number) {
    await this.app.settings.updateSetting(setting, value, translateType(type));
});

Then('the {word} setting {string} will be {word}', async function(type: SettingType, setting: string, enabledOrDisabled: EnabledOrDisabled) {
    const value = await this.app.settings.getSetting<boolean>(setting, translateType(type));
    assert.equal(value, enabledOrDisabled === 'enabled');
});
Then('the workspace setting {string} does not exist', async function(setting: string) {
    const value = await this.app.settings.getSetting<boolean>(setting, ConfigurationTarget.WorkspaceFolder);
    assert.equal(value, undefined);
});
Then('the workspace setting {string} has the value {string}', async function(setting: string, expectedValue: string) {
    const value = await this.app.settings.getSetting<string>(setting, ConfigurationTarget.WorkspaceFolder);
    assert.equal(value, expectedValue);
});
Then('the workspace setting {string} has the value {int}', async function(setting: string, expectedValue: number) {
    const value = await this.app.settings.getSetting<number>(setting, ConfigurationTarget.WorkspaceFolder);
    assert.equal(value, expectedValue);
});
Then('the workspace setting {string} contains the value {string}', async function(setting: string, expectedValue: string) {
    const value = await this.app.settings.getSetting<string>(setting, ConfigurationTarget.WorkspaceFolder);
    assert.notEqual(value, undefined);
    assert.equal(value!.indexOf(expectedValue) >= 0, expectedValue);
});
