// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

mod common;

#[test]
#[cfg(unix)]
fn find_python_in_path_this() {
    use crate::common::{
        assert_messages, create_test_dispatcher, create_test_environment, join_test_paths,
        test_file_path,
    };
    use python_finder::{common_python, messaging::PythonEnvironment};
    use serde_json::json;
    use std::collections::HashMap;

    let unix_python = test_file_path(&["tests/unix/known"]);
    let unix_python_exe = join_test_paths(&[unix_python.clone().to_str().unwrap(), "python"]);

    let mut dispatcher = create_test_dispatcher();
    let known = create_test_environment(
        HashMap::from([(
            "PATH".to_string(),
            unix_python.clone().to_str().unwrap().to_string(),
        )]),
        Some(unix_python.clone()),
        Vec::new(),
    );

    common_python::find_and_report(&mut dispatcher, &known);

    assert_eq!(dispatcher.messages.len(), 1);
    let env = PythonEnvironment {
        env_manager: None,
        project_path: None,
        name: None,
        python_executable_path: Some(unix_python_exe.clone()),
        category: python_finder::messaging::PythonEnvironmentCategory::System,
        version: None,
        python_run_command: Some(vec![unix_python_exe.clone().to_str().unwrap().to_string()]),
        env_path: Some(unix_python.clone()),
        sys_prefix_path: Some(unix_python.clone()),
    };
    assert_messages(&[json!(env)], &dispatcher);
}
