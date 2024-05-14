// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

mod common;

#[test]
#[cfg(unix)]
fn does_not_find_any_conda_envs() {
    use crate::common::{create_test_environment, get_environments_from_result};
    use python_finder::{conda, locator::Locator};
    use std::{collections::HashMap, path::PathBuf};

    let known = create_test_environment(
        HashMap::from([("PATH".to_string(), "".to_string())]),
        Some(PathBuf::from("SOME_BOGUS_HOME_DIR")),
        Vec::new(),
    );

    let mut locator = conda::Conda::with(&known);
    let result = locator.find();

    let environments = get_environments_from_result(&result);
    assert_eq!(environments.len(), 0);
}

#[test]
#[cfg(unix)]
fn find_conda_exe_and_empty_envs() {
    use crate::common::{
        assert_messages, create_test_environment, get_managers_from_result, join_test_paths,
        test_file_path,
    };
    use python_finder::messaging::{EnvManager, EnvManagerType};
    use python_finder::{conda, locator::Locator};
    use serde_json::json;
    use std::collections::HashMap;
    let user_home = test_file_path(&["tests/unix/conda_without_envs"]);
    let conda_dir = test_file_path(&["tests/unix/conda_without_envs"]);

    let known = create_test_environment(
        HashMap::from([(
            "PATH".to_string(),
            conda_dir.clone().to_str().unwrap().to_string(),
        )]),
        Some(user_home),
        Vec::new(),
    );

    let mut locator = conda::Conda::with(&known);
    let result = locator.find();
    let managers = get_managers_from_result(&result);
    assert_eq!(managers.len(), 1);

    let conda_exe = join_test_paths(&[
        conda_dir.clone().to_str().unwrap(),
        "anaconda3",
        "bin",
        "conda",
    ]);
    let expected_conda_manager = EnvManager {
        executable_path: conda_exe.clone(),
        version: Some("4.0.2".to_string()),
        tool: EnvManagerType::Conda,
    };
    assert_messages(
        &[json!(expected_conda_manager)],
        &managers.iter().map(|e| json!(e)).collect::<Vec<_>>(),
    )
}
#[test]
#[cfg(unix)]
fn finds_two_conda_envs_from_txt() {
    use crate::common::{
        assert_messages, create_test_environment, get_environments_from_result,
        get_managers_from_result, join_test_paths, test_file_path,
    };
    use python_finder::messaging::{EnvManager, EnvManagerType, PythonEnvironment};
    use python_finder::{conda, locator::Locator};
    use serde_json::json;
    use std::collections::HashMap;
    use std::fs;

    let home = test_file_path(&["tests/unix/conda"]);
    let conda_dir = test_file_path(&["tests/unix/conda/anaconda3"]);
    let conda_1 = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "envs/one"]);
    let conda_2 = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "envs/two"]);
    let _ = fs::write(
        "tests/unix/conda/.conda/environments.txt",
        format!(
            "{}\n{}",
            conda_1.clone().to_str().unwrap().to_string(),
            conda_2.clone().to_str().unwrap().to_string()
        ),
    );

    let known = create_test_environment(
        HashMap::from([(
            "PATH".to_string(),
            conda_dir.clone().to_str().unwrap().to_string(),
        )]),
        Some(home),
        Vec::new(),
    );

    let mut locator = conda::Conda::with(&known);
    let result = locator.find();

    let managers = get_managers_from_result(&result);
    let environments = get_environments_from_result(&result);
    assert_eq!(managers.len(), 1);

    let conda_exe = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "bin", "conda"]);
    let conda_1_exe = join_test_paths(&[conda_1.clone().to_str().unwrap(), "python"]);
    let conda_2_exe = join_test_paths(&[conda_2.clone().to_str().unwrap(), "python"]);

    let expected_conda_manager = EnvManager {
        executable_path: conda_exe.clone(),
        version: Some("4.0.2".to_string()),
        tool: EnvManagerType::Conda,
    };
    let expected_conda_1 = PythonEnvironment {
        display_name: None,
        name: Some("one".to_string()),
        project_path: None,
        python_executable_path: Some(conda_1_exe.clone()),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: Some("10.0.1".to_string()),
        env_path: Some(conda_1.clone()),
        sys_prefix_path: Some(conda_1.clone()),
        env_manager: Some(expected_conda_manager.clone()),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "one".to_string(),
            "python".to_string(),
            ]),
        };
        let expected_conda_2 = PythonEnvironment {
        display_name: None,
        name: Some("two".to_string()),
        project_path: None,
        python_executable_path: Some(conda_2_exe.clone()),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: None,
        env_path: Some(conda_2.clone()),
        sys_prefix_path: Some(conda_2.clone()),
        env_manager: Some(expected_conda_manager.clone()),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "two".to_string(),
            "python".to_string(),
        ]),
    };
    assert_messages(
        &[json!(expected_conda_manager)],
        &managers.iter().map(|e| json!(e)).collect::<Vec<_>>(),
    );
    assert_messages(
        &[json!(expected_conda_1), json!(expected_conda_2)],
        &environments.iter().map(|e| json!(e)).collect::<Vec<_>>(),
    );
}
