@terminal
Feature: Statusbar
    Background: Activted Extension
        Given the python extension has been activated

    @smoke
    Scenario: Interpreter is displayed in the statusbar
        Then the python interpreter displayed in the the status bar contains the value "Python" in the display name

    @python2
    Scenario: Can select a Python 2.7 interpreter
        When I select the Python Interpreter containing the name "2.7"
        Then the python interpreter displayed in the the status bar contains the value "2.7" in the display name

    @python3
    Scenario: Can select a Python 3 interpreter
        When I select the Python Interpreter containing the name "3."
        Then the python interpreter displayed in the the status bar contains the value "3." in the display name
