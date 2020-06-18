// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { CharacterPair, CommentRule, EnterAction, IndentationRule, LanguageConfiguration, OnEnterRule } from 'vscode';

// tslint:disable: no-any

export interface IRegExpDto {
    pattern: string;
    flags?: string;
}
export interface IIndentationRuleDto {
    decreaseIndentPattern: IRegExpDto;
    increaseIndentPattern: IRegExpDto;
    indentNextLinePattern?: IRegExpDto;
    unIndentedLinePattern?: IRegExpDto;
}
export interface IOnEnterRuleDto {
    beforeText: IRegExpDto;
    afterText?: IRegExpDto;
    oneLineAboveText?: IRegExpDto;
    action: EnterAction;
}
export interface ILanguageConfigurationDto {
    comments?: CommentRule;
    brackets?: CharacterPair[];
    wordPattern?: IRegExpDto;
    indentationRules?: IIndentationRuleDto;
    onEnterRules?: IOnEnterRuleDto[];
    __electricCharacterSupport?: {
        brackets?: any;
        docComment?: {
            scope: string;
            open: string;
            lineStart: string;
            close?: string;
        };
    };
    __characterPairSupport?: {
        autoClosingPairs: {
            open: string;
            close: string;
            notIn?: string[];
        }[];
    };
}
// Copied most of this from VS code directly.

function regExpFlags(regexp: RegExp): string {
    return (
        (regexp.global ? 'g' : '') +
        (regexp.ignoreCase ? 'i' : '') +
        (regexp.multiline ? 'm' : '') +
        ((regexp as any) /* standalone editor compilation */.unicode ? 'u' : '')
    );
}

function _serializeRegExp(regExp: RegExp): IRegExpDto {
    return {
        pattern: regExp.source,
        flags: regExpFlags(regExp)
    };
}

function _serializeIndentationRule(indentationRule: IndentationRule): IIndentationRuleDto {
    return {
        decreaseIndentPattern: _serializeRegExp(indentationRule.decreaseIndentPattern),
        increaseIndentPattern: _serializeRegExp(indentationRule.increaseIndentPattern),
        indentNextLinePattern: indentationRule.indentNextLinePattern
            ? _serializeRegExp(indentationRule.indentNextLinePattern)
            : undefined,
        unIndentedLinePattern: indentationRule.unIndentedLinePattern
            ? _serializeRegExp(indentationRule.unIndentedLinePattern)
            : undefined
    };
}

function _serializeOnEnterRule(onEnterRule: OnEnterRule): IOnEnterRuleDto {
    return {
        beforeText: _serializeRegExp(onEnterRule.beforeText),
        afterText: onEnterRule.afterText ? _serializeRegExp(onEnterRule.afterText) : undefined,
        oneLineAboveText: (onEnterRule as any).oneLineAboveText
            ? _serializeRegExp((onEnterRule as any).oneLineAboveText)
            : undefined,
        action: onEnterRule.action
    };
}

function _serializeOnEnterRules(onEnterRules: OnEnterRule[]): IOnEnterRuleDto[] {
    return onEnterRules.map(_serializeOnEnterRule);
}

function _reviveRegExp(regExp: IRegExpDto): RegExp {
    return new RegExp(regExp.pattern, regExp.flags);
}

function _reviveIndentationRule(indentationRule: IIndentationRuleDto): IndentationRule {
    return {
        decreaseIndentPattern: _reviveRegExp(indentationRule.decreaseIndentPattern),
        increaseIndentPattern: _reviveRegExp(indentationRule.increaseIndentPattern),
        indentNextLinePattern: indentationRule.indentNextLinePattern
            ? _reviveRegExp(indentationRule.indentNextLinePattern)
            : undefined,
        unIndentedLinePattern: indentationRule.unIndentedLinePattern
            ? _reviveRegExp(indentationRule.unIndentedLinePattern)
            : undefined
    };
}

function _reviveOnEnterRule(onEnterRule: IOnEnterRuleDto): OnEnterRule {
    return {
        beforeText: _reviveRegExp(onEnterRule.beforeText),
        afterText: onEnterRule.afterText ? _reviveRegExp(onEnterRule.afterText) : undefined,
        oneLineAboveText: onEnterRule.oneLineAboveText ? _reviveRegExp(onEnterRule.oneLineAboveText) : undefined,
        action: onEnterRule.action
    } as any;
}

function _reviveOnEnterRules(onEnterRules: IOnEnterRuleDto[]): OnEnterRule[] {
    return onEnterRules.map(_reviveOnEnterRule);
}

export function serializeLanguageConfiguration(
    configuration: LanguageConfiguration | undefined
): ILanguageConfigurationDto {
    return {
        ...configuration,
        wordPattern: configuration?.wordPattern ? _serializeRegExp(configuration.wordPattern) : undefined,
        indentationRules: configuration?.indentationRules
            ? _serializeIndentationRule(configuration.indentationRules)
            : undefined,
        onEnterRules: configuration?.onEnterRules ? _serializeOnEnterRules(configuration.onEnterRules) : undefined
    };
}

export function deserializeLanguageConfiguration(configuration: ILanguageConfigurationDto): LanguageConfiguration {
    return {
        ...configuration,
        wordPattern: configuration.wordPattern ? _reviveRegExp(configuration.wordPattern) : undefined,
        indentationRules: configuration.indentationRules
            ? _reviveIndentationRule(configuration.indentationRules)
            : undefined,
        onEnterRules: configuration.onEnterRules ? _reviveOnEnterRules(configuration.onEnterRules) : undefined
    };
}
