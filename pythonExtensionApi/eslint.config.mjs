import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
    // Base configuration for all files
    {
        ignores: ['**/out/**'],
    },
    {
        files: ['**/main.d.ts'],
        languageOptions: {
            parser: tsParser,
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'padding-line-between-statements': ['error', { blankLine: 'always', prev: 'export', next: '*' }],
        },
    },
];
