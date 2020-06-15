Added a start page for the extension. Launched in experimental mode such that it opens to new users or when there is a new release. It can be disabled with the setting 'Python: Show Start Page' and it can be opened at any time with the command 'Python: Open Start Page'.
Removed `python.jediEnabled` setting in favor of `python.languageServer`. Instead of `"python.jediEnabled": true` please use `"python.languageServer": "Jedi"`.
Made variable explorer (from IPython Notebook interface) resizable.
Added run-by-line for notebooks to allow users to step through their code cells line by line. Launched in experimental mode such that it is not currently shown to all users.
