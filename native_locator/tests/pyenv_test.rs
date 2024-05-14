// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

mod common;

#[test]
#[cfg(unix)]
fn does_not_find_any_pyenv_envs() {
    use crate::common::{
        create_test_environment, get_environments_from_result, get_managers_from_result,
    };
    use python_finder::{conda::Conda, locator::Locator, pyenv};
    use std::{collections::HashMap, path::PathBuf};

    let known = create_test_environment(
        HashMap::new(),
        Some(PathBuf::from("SOME_BOGUS_HOME_DIR")),
        Vec::new(),
    );

    let mut conda = Conda::with(&known);
    let mut locator = pyenv::PyEnv::with(&known, &mut conda);
    let result = locator.find();

    assert_eq!(get_managers_from_result(&result).len(), 0);
    assert_eq!(get_environments_from_result(&result).len(), 0);
}

#[test]
#[cfg(unix)]
fn does_not_find_any_pyenv_envs_even_with_pyenv_installed() {
    use crate::common::{
        assert_messages, create_test_environment, get_managers_from_result, join_test_paths,
        test_file_path,
    };
    use python_finder::pyenv;
    use python_finder::{conda::Conda, locator::Locator};
    use serde_json::json;
    use std::{collections::HashMap, path::PathBuf};

    let home = test_file_path(&["tests", "unix", "pyenv_without_envs"]);
    let homebrew_bin = join_test_paths(&[home.to_str().unwrap(), "opt", "homebrew", "bin"]);
    let pyenv_exe = join_test_paths(&[homebrew_bin.to_str().unwrap(), "pyenv"]);
    let known = create_test_environment(
        HashMap::new(),
        Some(home.clone()),
        vec![PathBuf::from(homebrew_bin)],
    );

    let mut conda = Conda::with(&known);
    let mut locator = pyenv::PyEnv::with(&known, &mut conda);
    let result = locator.find();

    let managers = get_managers_from_result(&result);
    assert_eq!(managers.len(), 1);

    let expected_json = json!({"executablePath":pyenv_exe,"version":null, "tool": "pyenv"});
    assert_messages(
        &[expected_json],
        &managers.iter().map(|e| json!(e)).collect::<Vec<_>>(),
    )
}

#[test]
#[cfg(unix)]
fn find_pyenv_envs() {
    use crate::common::{
        assert_messages, create_test_environment, get_environments_from_result,
        get_managers_from_result, join_test_paths, test_file_path,
    };
    use python_finder::conda::Conda;
    use python_finder::locator::Locator;
    use python_finder::{
        messaging::{EnvManager, EnvManagerType, PythonEnvironment},
        pyenv,
    };
    use serde_json::json;
    use std::{collections::HashMap, path::PathBuf};

    let home = test_file_path(&["tests", "unix", "pyenv"]);
    let homebrew_bin = join_test_paths(&[home.to_str().unwrap(), "opt", "homebrew", "bin"]);
    let pyenv_exe = join_test_paths(&[homebrew_bin.to_str().unwrap(), "pyenv"]);
    let known = create_test_environment(
        HashMap::new(),
        Some(home.clone()),
        vec![PathBuf::from(homebrew_bin)],
    );

    let mut conda = Conda::with(&known);
    let mut locator = pyenv::PyEnv::with(&known, &mut conda);
    let result = locator.find();

    let managers = get_managers_from_result(&result);
    assert_eq!(managers.len(), 1);

    let expected_manager = EnvManager {
        executable_path: pyenv_exe.clone(),
        version: None,
        tool: EnvManagerType::Pyenv,
    };

    assert_messages(
        &[json!(expected_manager)],
        &managers.iter().map(|e| json!(e)).collect::<Vec<_>>(),
    );

    let expected_3_9_9 = json!(PythonEnvironment {
        display_name: None,
        project_path: None,
        name: None,
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.9.9/bin/python"
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.9.9/bin/python"
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::Pyenv,
        version: Some("3.9.9".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.9.9"
        ])),
        env_manager: Some(expected_manager.clone())
    });
    let expected_virtual_env = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: Some("my-virtual-env".to_string()),
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env/bin/python",
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env/bin/python",
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::PyenvVirtualEnv,
        version: Some("3.10.13".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env",
        ])),
        env_manager: Some(expected_manager.clone()),
    };
    let expected_3_12_1 = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: None,
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1/bin/python",
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1/bin/python",
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::Pyenv,
        version: Some("3.12.1".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1",
        ])),
        env_manager: Some(expected_manager.clone()),
    };
    let expected_3_13_dev = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: None,
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.13-dev/bin/python",
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.13-dev/bin/python",
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::Pyenv,
        version: Some("3.13-dev".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.13-dev",
        ])),
        env_manager: Some(expected_manager.clone()),
    };
    let expected_3_12_1a3 = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: None,
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1a3/bin/python",
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1a3/bin/python",
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::Pyenv,
        version: Some("3.12.1a3".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1a3",
        ])),
        env_manager: Some(expected_manager.clone()),
    };
    let environments = get_environments_from_result(&result);

    assert_messages(
        &[
            json!(expected_3_9_9),
            json!(expected_virtual_env),
            json!(expected_3_12_1),
            json!(expected_3_13_dev),
            json!(expected_3_12_1a3),
        ],
        &environments.iter().map(|e| json!(e)).collect::<Vec<_>>(),
    )
}
