// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

mod common;

#[test]
#[cfg(unix)]
fn does_not_find_any_pyenv_envs() {
    use crate::common::{create_test_dispatcher, create_test_environment};
    use python_finder::pyenv;
    use std::collections::HashMap;

    let mut dispatcher = create_test_dispatcher();
    let known = create_test_environment(
        HashMap::new(),
        Some("SOME_BOGUS_HOME_DIR".to_string()),
        Vec::new(),
    );

    pyenv::find_and_report(&mut dispatcher, &known);

    assert_eq!(dispatcher.messages.len(), 0);
}

#[test]
#[cfg(unix)]
fn does_not_find_any_pyenv_envs_even_with_pyenv_installed() {
    use crate::common::{
        assert_messages, create_test_dispatcher, create_test_environment, join_test_paths,
        test_file_path,
    };
    use python_finder::pyenv;
    use serde_json::json;
    use std::{collections::HashMap, path::PathBuf};

    let mut dispatcher = create_test_dispatcher();
    let home = test_file_path(&["tests", "unix", "pyenv_without_envs"]);
    let homebrew_bin = join_test_paths(&[home.as_str(), "opt", "homebrew", "bin"]);
    let pyenv_exe = join_test_paths(&[homebrew_bin.as_str(), "pyenv"]);
    let known = create_test_environment(
        HashMap::new(),
        Some(home.clone()),
        vec![PathBuf::from(homebrew_bin)],
    );

    pyenv::find_and_report(&mut dispatcher, &known);

    assert_eq!(dispatcher.messages.len(), 1);
    let expected_json = json!({"executablePath":pyenv_exe,"version":null});
    assert_messages(&[expected_json], &dispatcher)
}

#[test]
#[cfg(unix)]
fn find_pyenv_envs() {
    use crate::common::{
        assert_messages, create_test_dispatcher, create_test_environment, join_test_paths,
        test_file_path,
    };
    use python_finder::pyenv;
    use serde_json::json;
    use std::{collections::HashMap, path::PathBuf};

    let mut dispatcher = create_test_dispatcher();
    let home = test_file_path(&["tests", "unix", "pyenv"]);
    let homebrew_bin = join_test_paths(&[home.as_str(), "opt", "homebrew", "bin"]);
    let pyenv_exe = join_test_paths(&[homebrew_bin.as_str(), "pyenv"]);
    let known = create_test_environment(
        HashMap::new(),
        Some(home.clone()),
        vec![PathBuf::from(homebrew_bin)],
    );

    pyenv::find_and_report(&mut dispatcher, &known);

    assert_eq!(dispatcher.messages.len(), 6);
    let expected_manager = json!({ "executablePath": pyenv_exe.clone(), "version": null });
    let expected_3_9_9 = json!({"projectPath": null, "name": null,"pythonExecutablePath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.9.9/bin/python"]), "pythonRunCommand": [join_test_paths(&[home.as_str(), ".pyenv/versions/3.9.9/bin/python"])], "category": "pyenv","version": "3.9.9","envPath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.9.9"]),"sysPrefixPath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.9.9"]), "envManager": expected_manager});
    let expected_virtual_env = json!({"projectPath": null, "name": "my-virtual-env", "version": "3.10.13", "category": "pyenvVirtualEnv", "envPath": join_test_paths(&[home.as_str(),".pyenv/versions/my-virtual-env"]), "pythonExecutablePath": join_test_paths(&[home.as_str(),".pyenv/versions/my-virtual-env/bin/python"]), "sysPrefixPath": join_test_paths(&[home.as_str(),".pyenv/versions/my-virtual-env"]), "pythonRunCommand": [join_test_paths(&[home.as_str(),".pyenv/versions/my-virtual-env/bin/python"])], "envManager": expected_manager});
    let expected_3_12_1 = json!({"projectPath": null, "name": null,"pythonExecutablePath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.12.1/bin/python"]), "pythonRunCommand": [join_test_paths(&[home.as_str(), ".pyenv/versions/3.12.1/bin/python"])], "category": "pyenv","version": "3.12.1","envPath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.12.1"]),"sysPrefixPath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.12.1"]), "envManager": expected_manager});
    let expected_3_13_dev = json!({"projectPath": null, "name": null,"pythonExecutablePath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.13-dev/bin/python"]), "pythonRunCommand": [join_test_paths(&[home.as_str(), ".pyenv/versions/3.13-dev/bin/python"])], "category": "pyenv","version": "3.13-dev","envPath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.13-dev"]),"sysPrefixPath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.13-dev"]), "envManager": expected_manager});
    let expected_3_12_1a3 = json!({"projectPath": null, "name": null,"pythonExecutablePath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.12.1a3/bin/python"]), "pythonRunCommand": [join_test_paths(&[home.as_str(), ".pyenv/versions/3.12.1a3/bin/python"])], "category": "pyenv","version": "3.12.1a3","envPath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.12.1a3"]),"sysPrefixPath": join_test_paths(&[home.as_str(), ".pyenv/versions/3.12.1a3"]), "envManager": expected_manager});
    assert_messages(
        &[
            expected_manager,
            expected_3_9_9,
            expected_virtual_env,
            expected_3_12_1,
            expected_3_13_dev,
            expected_3_12_1a3,
        ],
        &dispatcher,
    )
}
