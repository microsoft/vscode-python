// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

mod common;

#[test]
#[cfg(unix)]
fn does_not_find_any_conda_envs() {
    use crate::common::{create_test_dispatcher, create_test_environment};
    use python_finder::conda;
    use std::collections::HashMap;

    let mut dispatcher = create_test_dispatcher();
    let known = create_test_environment(
        HashMap::from([("PATH".to_string(), "".to_string())]),
        Some("SOME_BOGUS_HOME_DIR".to_string()),
        Vec::new(),
    );

    conda::find_and_report(&mut dispatcher, &known);

    assert_eq!(dispatcher.messages.len(), 0);
}

#[test]
#[cfg(unix)]
fn find_conda_exe_and_empty_envs() {
    use crate::common::{
        assert_messages, create_test_dispatcher, create_test_environment, join_test_paths,
        test_file_path,
    };
    use python_finder::conda;
    use serde_json::json;
    use std::collections::HashMap;
    let conda_dir = test_file_path(&["tests/unix/conda_without_envs"]);

    let mut dispatcher = create_test_dispatcher();
    let known = create_test_environment(
        HashMap::from([("PATH".to_string(), conda_dir.clone())]),
        Some("SOME_BOGUS_HOME_DIR".to_string()),
        Vec::new(),
    );

    conda::find_and_report(&mut dispatcher, &known);

    let conda_exe = join_test_paths(&[conda_dir.clone().as_str(), "conda"]);
    let expected_json = json!({"executablePath":[conda_exe.clone()],"version":null});
    assert_messages(&[expected_json], &dispatcher)
}
#[test]
#[cfg(unix)]
fn finds_two_conda_envs_from_txt() {
    use crate::common::{
        assert_messages, create_test_dispatcher, create_test_environment, join_test_paths,
        test_file_path,
    };
    use python_finder::conda;
    use serde_json::json;
    use std::collections::HashMap;
    use std::fs;

    let conda_dir = test_file_path(&["tests/unix/conda"]);
    let conda_1 = join_test_paths(&[conda_dir.clone().as_str(), "envs/one"]);
    let conda_2 = join_test_paths(&[conda_dir.clone().as_str(), "envs/two"]);
    let _ = fs::write(
        "tests/unix/conda/.conda/environments.txt",
        format!("{}\n{}", conda_1.clone(), conda_2.clone()),
    );

    let mut dispatcher = create_test_dispatcher();
    let known = create_test_environment(
        HashMap::from([("PATH".to_string(), conda_dir.clone())]),
        Some(conda_dir.clone()),
        Vec::new(),
    );

    conda::find_and_report(&mut dispatcher, &known);

    let conda_exe = join_test_paths(&[conda_dir.clone().as_str(), "conda"]);
    let conda_1_exe = join_test_paths(&[conda_1.clone().as_str(), "python"]);
    let conda_2_exe = join_test_paths(&[conda_2.clone().as_str(), "python"]);

    let expected_conda_env = json!({"executablePath":[conda_exe.clone()],"version":null});
    let expected_conda_1 = json!({"name":"one","pythonExecutablePath":[conda_1_exe.clone()],"category":"conda","version":"10.0.1","activatedRun":[conda_exe.clone(),"run","-n","one","python"],"envPath":conda_1.clone(), "sysPrefixPath":conda_1.clone()});
    let expected_conda_2 = json!({"name":"two","pythonExecutablePath":[conda_2_exe.clone()],"category":"conda","version":null,"activatedRun":[conda_exe.clone(),"run","-n","two","python"],"envPath":conda_2.clone(), "sysPrefixPath":conda_2.clone()});
    assert_messages(
        &[expected_conda_env, expected_conda_1, expected_conda_2],
        &dispatcher,
    )
}
