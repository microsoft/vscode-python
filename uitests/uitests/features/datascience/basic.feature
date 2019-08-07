# @ds @smoke
# @https://github.com/DonJayamanne/vscode-python-uitests/datascience
# Feature: Data Science
#     Scenario: Can display an image and print text into the interactive window
#         Given the package "jupyter" is installed
#         And a file named "log.log" does not exist
#         # Increase font size for text detection.
#         And the workspace setting "editor.fontSize" has the value 15
#         And the file "smoke.py" is open
#         When I wait for the Python extension to activate
#         # Code will display an image and print stuff into interactive window.
#         When I select the command "Python: Run All Cells"
#         # Wait for Interactive Window to open
#         And I wait for 10 seconds
#         # Close the file, to close it, first set focus to it by opening it again.
#         And I open the file "smoke.py"
#         And I select the command "View: Revert and Close Editor"
#         And I select the command "View: Close Panel"
#         # Wait for 2 minutes for Jupyter to start
#         Then a file named "log.log" will be created within 120 seconds
#     # This is the content of the image rendered in the interactive window.
#     # And the text "VSCODEROCKS" is displayed in the Interactive Window
#     # # This is the content printed by a python script.
#     # And the text "DATASCIENCEROCKS" is displayed in the Interactive Window

#     Scenario: Workspace directory is used as cwd for untitled python files
#         Given the package "jupyter" is installed
#         And a file named "log.log" does not exist
#         When I wait for the Python extension to activate
#         When I create an untitled Python file with the following contents
#             """
#             open("log.log", "w").write("Hello")
#             """
#         # Code will display an image and print stuff into interactive window.
#         When I select the command "Python: Run All Cells"
#         # Wait for Interactive Window to open
#         And I wait for 10 seconds
#         # Wait for 2 minutes for Jupyter to start
#         Then a file named "log.log" will be created within 120 seconds
