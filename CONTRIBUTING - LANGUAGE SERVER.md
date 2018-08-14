# Contributing to Microsoft Python Language Server
[![Contributing to Python Tools for Visual Studio](https://github.com/Microsoft/PTVS/blob/master/CONTRIBUTING.md)]

[![Build Status (Travis)](https://travis-ci.org/Microsoft/vscode-python.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-python) [![Build status (AppVeyor)](https://ci.appveyor.com/api/projects/status/s0pt8d79gqw222j7?svg=true)](https://ci.appveyor.com/project/DonJayamanne/vscode-python-v3vd6) [![codecov](https://codecov.io/gh/Microsoft/vscode-python/branch/master/graph/badge.svg)](https://codecov.io/gh/Microsoft/vscode-python)


## Contributing a pull request

### Prerequisites

1. .NET Core 2.1 SDK
   - [Windows](https://www.microsoft.com/net/learn/get-started/windows)
   - [Mac OS](https://www.microsoft.com/net/learn/get-started/macos)
   - [Linux](https://www.microsoft.com/net/learn/get-started/linux/rhel)
2. C# Extension to VS Code (all platforms)
3. Python 2.7
4. Python 3.6

*Alternative:* [Visual Studio 2017](https://www.visualstudio.com/downloads/) (Windows only) with .NET Core and C# Workloads. Community Edition is free and is fully functional.

### Setup

```shell
git clone https://github.com/microsoft/ptvs
cd ptvs/Python/Product/VSCode/AnalysisVsc
dotnet build
```

Visual Studio 2017:
1. Open solution in Python/Product/VsCode
2. Build AnalysisVsc project
3. Binaries arrive in *Python/BuildOutput/VsCode/raw*
4. Delete contents of the *languageServer* folder in the Python Extension folder
5. Copy *.dll, *.pdb, *.json fron *Python/BuildOutput/VsCode/raw* to *languageServer*
6. In VS Code set setting *python.downloadLanguageServer* to *false*
7. In VS Code set setting *python.jediEnabled* to *false*

### Debugging code in Python Extension to VS Code
Folow regular TypeScript debugging steps

### Debugging C# code in Python Analysis Engine
1. Launch another instance of VS Code
2. Open Python/Product/VsCode/AnalysisVsc folder
3. Python Analysis Engine code is in *Python/Product/VsCode/Analysis*
4. Run extension from VS Code
5. In the instance with C# code select Dotnet Attach launch task.
6. Attach to *dotnet* process running *Microsoft.Python.languageServer.dll*

On Windows you can also attach from Visual Studio 2017.

### Validate your changes

1. Build C# code
2. Copy binaries to *analysis* folder
3. Use the `Launch Extension` launch option.

### Unit Tests
1. Run the Unit Tests via the `Launch Analysis Engine Tests`.
2. On Windows you can also open complete PTVS solution in Visual Studio and run its tests (or at least the Analysis section).


### Coding Standards
See [![Contributing to Python Tools for Visual Studio](https://github.com/Microsoft/PTVS/blob/master/CONTRIBUTING.md)]
