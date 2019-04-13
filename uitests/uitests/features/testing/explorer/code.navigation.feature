@test
@git://github.com/DonJayamanne/pyvscSmokeTesting.git
Feature: Test Explorer Discovering icons and stop discovery
    Scenario: When navigating to a test file, suite & test, then open the file and set the cursor at the right line (unitest)
        Given the workspace setting "python.unitTest.pyTestEnabled" is disabled
        And the workspace setting "python.unitTest.unittestEnabled" is enabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is disabled
        And the command "View: Close All Editors" is selected
        When I reload VSC
        When I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I navigate to the code associated with test node number 2
        Then the file "test_one.py" is opened
        When I navigate to the code associated with test node number 3
        Then the file "test_one.py" is opened
        And the cursor is on line 19
        When I navigate to the code associated with test node number 4
        Then the file "test_one.py" is opened
        And the cursor is on line 20
        When I navigate to the code associated with test node number 5
        Then the file "test_one.py" is opened
        And the cursor is on line 30

    Scenario: When navigating to a test file, suite & test, then open the file and set the cursor at the right line (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.unitTest.pyTestEnabled" is enabled
        And the workspace setting "python.unitTest.unittestEnabled" is disabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is disabled
        When I reload VSC
        When I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I navigate to the code associated with test node number 2
        Then the file "test_one.py" is opened
        When I navigate to the code associated with test node number 3
        Then the file "test_one.py" is opened
        And the cursor is on line 19
        When I navigate to the code associated with test node number 4
        Then the file "test_one.py" is opened
        And the cursor is on line 20
        When I navigate to the code associated with test node number 5
        Then the file "test_one.py" is opened
        And the cursor is on line 30

    Scenario: When navigating to a test file, suite & test, then open the file and set the cursor at the right line (nose)
        Given the package "nose" is installed
        And the workspace setting "python.unitTest.pyTestEnabled" is disabled
        And the workspace setting "python.unitTest.unittestEnabled" is disabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is enabled
        When I reload VSC
        When I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I navigate to the code associated with test node number 2
        Then the file "test_one.py" is opened
        When I navigate to the code associated with test node number 3
        Then the file "test_one.py" is opened
        And the cursor is on line 19
        When I navigate to the code associated with test node number 4
        Then the file "test_one.py" is opened
        And the cursor is on line 20
        When I navigate to the code associated with test node number 5
        Then the file "test_one.py" is opened
        And the cursor is on line 30

    Scenario: When selecting a node, then open the file (unitest)
        Given the workspace setting "python.unitTest.pyTestEnabled" is disabled
        And the workspace setting "python.unitTest.unittestEnabled" is enabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is disabled
        And the command "View: Close All Editors" is selected
        When I reload VSC
        When I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I click node number 2
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node number 3
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node number 4
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node number 5
        Then the file "test_one.py" is opened


    Scenario: When selecting a node, then open the file (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.unitTest.pyTestEnabled" is enabled
        And the workspace setting "python.unitTest.unittestEnabled" is disabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is disabled
        When I reload VSC
        When I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I click node number 2
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node number 3
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node number 4
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node number 5
        Then the file "test_one.py" is opened

    Scenario: When selecting a node, then open the file (nose)
        Given the package "nose" is installed
        And the workspace setting "python.unitTest.pyTestEnabled" is disabled
        And the workspace setting "python.unitTest.unittestEnabled" is disabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is enabled
        When I reload VSC
        When I select the command "Python: Discover Unit Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I click node number 2
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node number 3
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node number 4
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node number 5
        Then the file "test_one.py" is opened
