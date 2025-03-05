/**
 * ESLint Configuration for VS Code Python Extension
 * This file configures linting rules for the TypeScript/JavaScript codebase.
 * It uses the new flat config format introduced in ESLint 8.21.0
 */

// Import essential ESLint plugins and configurations
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import noOnlyTests from 'eslint-plugin-no-only-tests';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import js from '@eslint/js';

export default [
    {
        ignores: ['**/node_modules/**', '**/out/**'],
    },
    // Base configuration for all files
    {
        ignores: ['**/node_modules/**', '**/out/**'],
        linterOptions: {
            reportUnusedDisableDirectives: 'off',
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-undef': 'off',
        },
    },
    // TypeScript-specific configuration
    {
        files: ['**/*.ts', '**/*.tsx', 'src', 'pythonExtensionApi/src'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
            globals: {
                ...(js.configs.recommended.languageOptions?.globals || {}),
                mocha: true,
                require: 'readonly',
                process: 'readonly',
                exports: 'readonly',
                module: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            'no-only-tests': noOnlyTests,
            import: importPlugin,
            prettier: prettier,
        },
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.ts'],
                },
            },
        },
        rules: {
            // Base configurations
            ...tseslint.configs.recommended.rules,
            ...prettier.rules,

            // TypeScript-specific rules
            '@typescript-eslint/ban-ts-comment': [
                'error',
                {
                    'ts-ignore': 'allow-with-description',
                },
            ],
            '@typescript-eslint/ban-types': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-empty-interface': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-loss-of-precision': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    varsIgnorePattern: '^_',
                    argsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-use-before-define': [
                'error',
                {
                    functions: false,
                },
            ],

            // Import rules
            'import/extensions': 'off',
            'import/namespace': 'off',
            'import/no-extraneous-dependencies': 'off',
            'import/no-unresolved': 'off',
            'import/prefer-default-export': 'off',

            // Testing rules
            'no-only-tests/no-only-tests': [
                'error',
                {
                    block: ['test', 'suite'],
                    focus: ['only'],
                },
            ],

            // Code style rules
            'linebreak-style': 'off',
            'no-bitwise': 'off',
            'no-console': 'off',
            'no-underscore-dangle': 'off',
            'operator-assignment': 'off',
            'func-names': 'off',

            // Error handling and control flow
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-async-promise-executor': 'off',
            'no-await-in-loop': 'off',
            'no-unreachable': 'off',
            'no-void': 'off',

            // Duplicates and overrides (TypeScript handles these)
            'no-dupe-class-members': 'off',
            'no-redeclare': 'off',
            'no-undef': 'off',

            // Miscellaneous rules
            'no-control-regex': 'off',
            'no-extend-native': 'off',
            'no-inner-declarations': 'off',
            'no-multi-str': 'off',
            'no-param-reassign': 'off',
            'no-prototype-builtins': 'off',
            'no-empty-function': 'off',
            'no-template-curly-in-string': 'off',
            'no-useless-escape': 'off',
            'no-extra-parentheses': 'off',
            strict: 'off',

            // Restricted syntax
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'ForInStatement',
                    message:
                        'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
                },
                {
                    selector: 'LabeledStatement',
                    message:
                        'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
                },
                {
                    selector: 'WithStatement',
                    message:
                        '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
                },
            ],
        },
    },
];
