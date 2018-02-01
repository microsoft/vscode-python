// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable-next-line:no-require-imports no-var-requires
const unicodeLu = require('unicode/category/Lu');
// tslint:disable-next-line:no-require-imports no-var-requires
const unicodeLl = require('unicode/category/Ll');
// tslint:disable-next-line:no-require-imports no-var-requires
const unicodeLt = require('unicode/category/Lt');
// tslint:disable-next-line:no-require-imports no-var-requires
const unicodeLo = require('unicode/category/Lo');
// tslint:disable-next-line:no-require-imports no-var-requires
const unicodeLm = require('unicode/category/Lm');
// tslint:disable-next-line:no-require-imports no-var-requires
const unicodeNl = require('unicode/category/Nl');
// tslint:disable-next-line:no-require-imports no-var-requires
const unicodeMn = require('unicode/category/Mn');
// tslint:disable-next-line:no-require-imports no-var-requires
const unicodeMc = require('unicode/category/Mc');
// tslint:disable-next-line:no-require-imports no-var-requires
const unicodeNd = require('unicode/category/Nd');
// tslint:disable-next-line:no-require-imports no-var-requires
const unicodePc = require('unicode/category/Pc');

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
    ConnectorPunctuation
}

export function getUnicodeCategory(ch: number): UnicodeCategory {
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
