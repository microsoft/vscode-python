
## TO ADD A NEW EXPORT METHOD
1. Create a new command in src/client/datascience/constants
2. Register the command in this file
3. Add an item to the quick pick menu for your new export method from inside the getExportQuickPickItems() method (in this file).
4. Add a new command to the command pallete in package.json (optional)
5. Declare and add your file extensions inside exportManagerFilePicker
6. Declare and add your export method inside exportManager
7. Create an injectable class that implements IExport and register it in src/client/datascience/serviceRegistry
8. Implement the export method on your new class
9. Inject the class inside exportManager
10. Add a case for your new export method and call the export method of your new class with the appropriate arguments
11. Add telementry and status messages
