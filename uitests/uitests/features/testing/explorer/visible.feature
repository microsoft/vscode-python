@test
@git://github.com/DonJayamanne/pyvscSmokeTesting.git
Feature: Test Explorer

    Scenario: Explorer will be displayed when tests are discovered (unitest)
        Given the workspace setting "python.unitTest.pyTestEnabled" is disabled
        And the workspace setting "python.unitTest.unittestEnabled" is enabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is disabled
        When I reload VSC
        And I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible

    Scenario: Explorer will be displayed when tests are discovered (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.unitTest.pyTestEnabled" is enabled
        And the workspace setting "python.unitTest.unittestEnabled" is disabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is enabled
        When I reload VSC
        And I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible

    Scenario: Explorer will be displayed when tests are discovered (nose)
        Given the package "nose" is installed
        And the workspace setting "python.unitTest.pyTestEnabled" is disabled
        And the workspace setting "python.unitTest.unittestEnabled" is disabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is enabled
        When I reload VSC
        And I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible
