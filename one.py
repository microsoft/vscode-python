def do():
    from selenium import webdriver
    import sys
    import os

    sys.path.append(".vscode-smoke")
    os.environ["PATH"] += os.pathsep + ".vscode-smoke/vscode"
    # os.environ["ELECTRON_RUN_AS_NODE"] = "1"
    options = webdriver.ChromeOptions()
    options.binary_location = "/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/.vscode-smoke/vscode/Visual Studio Code.app/Contents/MacOS/Electron"
    args = [
        "/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/uwow/wksp",
        "--extensions-dir=/Users/donjayamanne/.vscode-insiders/xx",
        "--extensionDevelopmentPath=/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode",
        "--user-data-dir=/Users/donjayamanne/Desktop/Development/PythonStuff/smoke tests/testData/d0",
    ]
    args = [
        # "/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/.vscode-smoke/vscode/Visual Studio Code.app/Contents/Resources/app/out/main.js",
        # "/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/.vscode-smoke/vscode/Visual Studio Code.app/Contents/Resources/app/out/cli.js",
        # "--",
        # "--",
        # "--",
        # "folder-uri",
        # "folder-uri=file:/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode",
        "folder-uri:file:/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/.vscode-smoke/workspace folder"
    ]
    # args = []
    for arg in args:
        options.add_argument(arg)

    driver = webdriver.Chrome(options=options)

    print("Started")

    import time

    time.sleep(5)
    print("Started")

    print("Started")
    # driver.get("http://www.google.com")


    try:
        ele = driver.find_element_by_css_selector(
            ".composite-bar .monaco-action-bar.vertical .actions-container"
        )
        print(ele)
        print('go for it')
        time.sleep(10)
        ele = driver.find_element_by_css_selector(
            ".composite-bar .monaco-action-bar.vertical .actions-container"
        )
        print(ele)
        print(ele.get_attribute("role"))
        print("yay")
    except:
        print("yikes")
        import traceback

        traceback.print_exc()
    print("nope")
    # print(ele)
    time.sleep(5)

    # driver.quit()

do()
