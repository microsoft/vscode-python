module.exports = {
    singleQuote: true,
    printWidth: 120,
    tabWidth: 4,
    overrides: [
        {
            files: ['*.yml', '*.yaml'],
            options: {
                tabWidth: 2
            }
        },
        {
            files: ['**/datascience/serviceRegistry.ts'],
            options: {
                printWidth: 240
            }
        }
    ]
};
