@test
@git://github.com/DonJayamanne/pyvscSmokeTesting.git
Feature: Test Explorer

    Scenario: Explorer will be displayed when tests are discovered (unitest)
        Given the workspace setting "python.unitTest.pyTestEnabled" is disabled
        And the workspace setting "python.unitTest.unittestEnabled" is enabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is disabled
        When I reload VSC
        When I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree

    Scenario: Explorer will be displayed when tests are discovered (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.unitTest.pyTestEnabled" is enabled
        And the workspace setting "python.unitTest.unittestEnabled" is disabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is disabled
        When I reload VSC
        When I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree

    Scenario: Explorer will be displayed when tests are discovered (nose)
        Given the package "nose" is installed
        And the workspace setting "python.unitTest.pyTestEnabled" is disabled
        And the workspace setting "python.unitTest.unittestEnabled" is disabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is enabled
        When I reload VSC
        When I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree
