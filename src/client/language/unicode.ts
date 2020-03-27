// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable:no-require-imports no-var-requires

export enum UnicodeCategory {
    Unknown,
    UppercaseLetter,
    LowercaseLetter,
    TitlecaseLetter,
    ModifierLetter,
    OtherLetter,
    LetterNumber,
    NonSpacingMark,
    SpacingCombiningMark,
    DecimalDigitNumber,
    ConnectorPunctuation,
}

export function getUnicodeCategory(ch: number): UnicodeCategory {
    const unicodeLu = require('unicode/category/Lu');
    const unicodeLl = require('unicode/category/Ll');
    const unicodeLt = require('unicode/category/Lt');
    const unicodeLo = require('unicode/category/Lo');
    const unicodeLm = require('unicode/category/Lm');
    const unicodeNl = require('unicode/category/Nl');
    const unicodeMn = require('unicode/category/Mn');
    const unicodeMc = require('unicode/category/Mc');
    const unicodeNd = require('unicode/category/Nd');
    const unicodePc = require('unicode/category/Pc');

    if (unicodeLu[ch]) {
        return UnicodeCategory.UppercaseLetter;
    }
    if (unicodeLl[ch]) {
        return UnicodeCategory.LowercaseLetter;
    }
    if (unicodeLt[ch]) {
        return UnicodeCategory.TitlecaseLetter;
    }
    if (unicodeLo[ch]) {
        return UnicodeCategory.OtherLetter;
    }
    if (unicodeLm[ch]) {
        return UnicodeCategory.ModifierLetter;
    }
    if (unicodeNl[ch]) {
        return UnicodeCategory.LetterNumber;
    }
    if (unicodeMn[ch]) {
        return UnicodeCategory.NonSpacingMark;
    }
    if (unicodeMc[ch]) {
        return UnicodeCategory.SpacingCombiningMark;
    }
    if (unicodeNd[ch]) {
        return UnicodeCategory.DecimalDigitNumber;
    }
    if (unicodePc[ch]) {
        return UnicodeCategory.ConnectorPunctuation;
    }
    return UnicodeCategory.Unknown;
}
