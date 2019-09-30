@ls
@code:code/languageServer/basic
Feature: Language Server
    @autoretry
    Scenario Outline: When <reload_or_start_vs_for_first_time> then navigate to the definition of a variable after opening file with Jedi enabled
        When <reload_or_start_vs_for_first_time>
        And I enable the workspace setting "python.jediEnabled"
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "Jedi Python language engine" will be displayed in the output panel within 10 seconds
        # Sometimes LS & Jedi are slow.
        And wait for 10 seconds
        When I open the file "my_sample.py"
        And I go to line 3, column 10
        # Wait for intellisense to kick in (sometimes slow in jedi & ls)
        And I wait for 10 seconds
        When I select the command "Go to Definition"
        Then the cursor is on line 1

        Examples:
            | reload_or_start_vs_for_first_time |
            | I open VS Code for the first time |
            | I reload VS Code                  |

    @autoretry
    Scenario Outline: When <reload_or_start_vs_for_first_time> then navigate to the definition of a variable after opening file with Language Server enabled
        When <reload_or_start_vs_for_first_time>
        And I disable the workspace setting "python.jediEnabled"
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "Microsoft Python language server" will be displayed in the output panel within 120 seconds
        When I select the command "Python: Show Language Server Output"
        Then the text "Initializing for" will be displayed in the output panel within 120 seconds
        # Sometimes LS & Jedi are slow.
        When I wait for 10 seconds
        Then the status bar item containing the text "Analyzing in background" will be hidden within 120 seconds
        When I open the file "my_sample.py"
        And I go to line 3, column 10
        # Wait for intellisense to kick in (sometimes slow in jedi & ls)
        And I wait for 10 seconds
        When I select the command "Go to Definition"
        Then the cursor is on line 1

        Examples:
            | reload_or_start_vs_for_first_time |
            | I open VS Code for the first time |
            | I reload VS Code                  |
