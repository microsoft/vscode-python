@ds
Feature: Data Science
    @smoke
    Scenario: Ensure cell in python file is executed within an interactive window
        """
        To test Data Science feature, just open a python file and run some code in the interactive window.
        Here the code that will be executed in the interactive window will create a file, if the file is created
        we know the test ran successfully.
        Allow 120 seconds for file to get created, as we need to give Jupyter server some time to start up.
        """
        Given the Python extension has been activated
        And the package "jupyter" is installed
        And a file named "log.log" does not exist
        And a file named "simple data science tests.py" is created with the following content
            """
            #%%
            with open('log.log', 'a') as fp:
                fp.write('Hello World!')
            """
        When I open the file "simple data science tests.py"
        And I select the command "Python: Run All Cells"
        Then a file named "log.log" is created within 120 seconds
