@terminal
Feature: Statusbar
    @smoke
    Scenario: Interpreter is displayed in the statusbar when a python file is opened
        When I create a new file
        And I change the language of the file to "Python"
        And the Python extension has activated
        Then the python the status bar contains the text "Python"

    @status
    Scenario: Interpreter is displayed in the statusbar when the extension is activated
        When the Python extension has activated
        Then the python the status bar contains the text "Python"

    @python2
    Scenario: Can select a Python 2.7 interpreter and the statusbar will be updated accordingly
        Given the Python extension has been activated
        When I select the Python Interpreter containing the text "2.7"
        Then the python the status bar contains the text "2.7"
        And the python the status bar does not contain the text "3."

    @python3
    Scenario: Can select a Python 3. interpreter and the statusbar will be updated accordingly
        Given the Python extension has been activated
        When I select the Python Interpreter containing the text "3."
        Then the python the status bar contains the text "3."
        And the python the status bar does not contain the text "2.7"

    @python2 @python3
    Scenario: Can switch between 2.7 and 3.* interpreters and the statusbar will be updated accordingly
        Given the Python extension has been activated
        When I select the Python Interpreter containing the text "2.7"
        Then the python the status bar contains the text "2.7"
        And the python the status bar does not contain the text "3."
        When I select the Python Interpreter containing the text "3."
        Then the python the status bar contains the text "3."
        And the python the status bar does not contain the text "2.7"
