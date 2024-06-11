// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

mod common;

#[test]
#[cfg(unix)]
fn find_python_in_path_this() {
    use crate::common::{
        assert_messages, create_test_environment, join_test_paths, test_file_path,
    };
    use python_finder::{common_python, locator::Locator, messaging::PythonEnvironment};
    use serde_json::json;
    use std::collections::HashMap;

    let user_home = test_file_path(&["tests/unix/known/user_home"]);
    let unix_python_exe = join_test_paths(&[user_home.clone().to_str().unwrap(), "python"]);

    let known = create_test_environment(
        HashMap::from([(
            "PATH".to_string(),
            user_home.clone().to_string_lossy().to_string(),
        )]),
        Some(user_home.clone()),
        Vec::new(),
        None,
    );

    let mut locator = common_python::PythonOnPath::with(&known);
    let result = locator.find().unwrap();

    assert_eq!(result.environments.len(), 1);

    let env = PythonEnvironment {
        display_name: None,
        env_manager: None,
        project_path: None,
        name: None,
        python_executable_path: Some(unix_python_exe.clone()),
        category: python_finder::messaging::PythonEnvironmentCategory::System,
        version: None,
        python_run_command: Some(vec![unix_python_exe.clone().to_str().unwrap().to_string()]),
        env_path: Some(user_home.clone()),
        arch: None,
        ..Default::default()
    };
    assert_messages(
        &[json!(env)],
        &result
            .environments
            .iter()
            .map(|e| json!(e))
            .collect::<Vec<_>>(),
    );
}
