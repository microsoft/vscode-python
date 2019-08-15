module.exports = {
    parser: '@typescript-eslint/parser', // Specifies the ESLint parser
    // plugins: ['@typescript-eslint'],
    extends: [
        'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
        'prettier',
        'prettier/@typescript-eslint', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
        'plugin:prettier/recommended' // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
    ],
    parserOptions: {
        project: './tsconfig.json'
    },
    rules: {
        // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
        '@typescript-eslint/explicit-function-return-type': 'off',
        // Typescript's unused variable checking is better, IMHO.
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/prefer-interface': 'off',
        //'space-before-function-paren': 'always'
        '@typescript-eslint/explicit-member-accessibility': [
            'error',
            {
                accessibility: 'explicit',
                overrides: {
                    constructors: 'off'
                }
            }
        ]
    },
    overrides: [
        {
            files: ['*.ts', '*.tsx'],
            rules: {
                'no-dupe-class-members': 'off'
            }
        }
    ]
};
