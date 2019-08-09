@terminal
Feature: Interpreter
    @mac @python2
    Scenario: Display message when selecting default Mac 2.7 Interpreter
        Given the Python extension has been activated
        When I select the Python Interpreter containing the text "/usr/bin/python"
        Then a message containing the text "You have selected the macOS system install of Python" is displayed

    Scenario: Opening VS Code for the first time will display tip about selecting interpreter
        Given VS Code is opened for the first time
        When the Python extension has activated
        Then a message containing the text "Tip: you can change the Python interpreter used by the Python extension by clicking" is displayed

    Scenario: Re-opening VS Code will display tip about selecting interpreter
        Given VS Code is opened for the first time
        When the Python extension has activated
        Then a message containing the text "Tip: you can change the Python interpreter used by the Python extension by clicking" is displayed
        When I reload VS Code
        And the Python extension has activated
        Then a message containing the text "Tip: you can change the Python interpreter used by the Python extension by clicking" is displayed

    Scenario: Re-opening VS Code will not display tip about selecting interpreter after clicking the 'Got it' button
        Given VS Code is opened for the first time
        Then the Python extension has activated
        Then a message containing the text "Tip: you can change the Python interpreter used by the Python extension by clicking" is displayed
        When I click the "Got it!" button for the message with the text "Tip: you can change the Python interpreter used by the Python extension by clicking"
        # Wait for state information to get persisted (of the fact that we closed this message).
        # I.e. wait a while before we close VS Code.
        And wait for 5 seconds
        And I reload VS Code
        And the Python extension has activated
        Then a message containing the text "Tip: you can change the Python interpreter used by the Python extension by clicking" is not displayed
