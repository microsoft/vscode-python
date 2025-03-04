import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import noOnlyTests from 'eslint-plugin-no-only-tests';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import js from '@eslint/js';

export default [
    {
        // Base JS recommended config
        ignores: ['**/node_modules/**', '**/out/**'],
        linterOptions: {
            reportUnusedDisableDirectives: 'off',
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-undef': 'off',
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
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
        },
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.ts'],
                },
            },
        },
        rules: {
            'import/no-unresolved': 'off', // ✅ Suppresses errors for "import/no-unresolved"
            // ✅ Suppresses undefined variable errors (e.g., "suite" not defined)
            '@typescript-eslint/explicit-module-boundary-types': 'off', // ✅ Suppresses function return type errors
            ...tseslint.configs.recommended.rules,
            ...prettier.rules,

            '@typescript-eslint/ban-ts-comment': [
                'error',
                {
                    'ts-ignore': 'allow-with-description',
                },
            ],
            'no-bitwise': 'off',
            'no-dupe-class-members': 'off',
            '@typescript-eslint/no-dupe-class-members': 'error',
            '@typescript-eslint/no-empty-interface': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-use-before-define': [
                'error',
                {
                    functions: false,
                },
            ],

            'no-useless-constructor': 'off',
            '@typescript-eslint/no-useless-constructor': 'error',
            '@typescript-eslint/no-var-requires': 'off',
            'func-names': 'off',
            'import/extensions': 'off',
            'import/namespace': 'off',
            'import/no-extraneous-dependencies': 'off',
            'import/prefer-default-export': 'off',
            'linebreak-style': 'off',
            'no-await-in-loop': 'off',
            'no-console': 'off',
            'no-control-regex': 'off',
            'no-extend-native': 'off',
            'no-multi-str': 'off',
            'no-shadow': 'off',
            'no-param-reassign': 'off',
            'no-prototype-builtins': 'off',
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
            'no-template-curly-in-string': 'off',
            'no-underscore-dangle': 'off',
            'no-useless-escape': 'off',
            'no-void': 'off',
            'operator-assignment': 'off',
            strict: 'off',
            'no-only-tests/no-only-tests': ['error', { block: ['test', 'suite'], focus: ['only'] }],
            'class-methods-use-this': 'off',
            '@typescript-eslint/ban-types': 'off',
            // '@typescript-eslint/no-empty-function': 'off',
            // 'import/no-unresolved': ['error', { ignore: ['vscode'] }],
            '@typescript-eslint/no-explicit-any': 'off',
            // add no-unreachable
            'no-unreachable': 'off',
            //add @typescript-eslint/no-empty-function
            'no-empty-function': 'off',
            'no-redeclare': 'off',
            '@typescript-eslint/no-loss-of-precision': 'off', // add @typescript-eslint/no-loss-of-precision
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-inner-declarations': 'off',
            'no-async-promise-executor': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
            'no-undef': 'off',
        },
    },
];
