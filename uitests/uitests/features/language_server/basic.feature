@ls @smoke
Feature: Language Server
    Scenario: Language Server loads and starts analyzing files
        Given the user setting "python.jediEnabled" is disabled
        When I reload VSC
        And I select the command "Python: Show Output"
        Then the output panel contains the text "Microsoft Python Language Server"
        And the output panel contains the text "Initializing for"

    Scenario: Navigate to definition of a variable
        Given the user setting "python.jediEnabled" is disabled
        And a file named "my_sample.py" is created with the following contents
            """
            some_variable_name = 1

            some_variable_name = 2
            """
        When I reload VSC
        And I select the command "Python: Show Output"
        Then the output panel contains the text "Microsoft Python Language Server"
        And the output panel contains the text "Initializing for"
        Given the file "my_sample.py" is open
        When I go to line 3
        And I select the command "Go to Definition"
        Then the cursor is on line 1
