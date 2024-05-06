// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use python_finder::{conda, messaging};
use serde::{Deserialize, Serialize};
use std::{env, path::PathBuf};

#[test]
#[cfg(unix)]
fn does_not_find_any_conda_envs() {
    env::set_var("PATH_TEST", "".to_string());
    env::set_var("USER_HOME", "SOME_BOGUS_HOME_DIR".to_string());
    messaging::clear_rpc_messages();

    conda::find_and_report();

    assert_eq!(messaging::get_rpc_messages().len(), 0);
}

#[test]
#[cfg(unix)]
fn find_conda_exe_and_empty_envs() {
    let conda_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/unix/conda");
    env::set_var("PATH_TEST", conda_dir.clone().to_str().unwrap());
    env::set_var("USER_HOME", "SOME_BOGUS_HOME_DIR".to_string());
    messaging::clear_rpc_messages();

    conda::find_and_report();

    assert_eq!(messaging::get_rpc_messages().len(), 1);
    let env: messaging::EnvManagerMessage =
        serde_json::from_str(&messaging::get_rpc_messages()[0]).unwrap();
    assert_eq!(
        env.params.executable_path,
        conda_dir.join("conda").to_str().unwrap()
    );
}

fn get_message(message: &str) -> String {
    #[derive(Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct BaseMessage {
        pub jsonrpc: String,
        pub method: String,
    }

    let msg: BaseMessage = serde_json::from_str(message).unwrap();
    msg.method
}
#[test]
#[cfg(unix)]
fn finds_two_conda_envs_from_txt() {
    use std::fs;

    let conda_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/unix/conda");
    let conda_one = conda_dir.join("envs/one");
    let conda_two = conda_dir.join("envs/two");
    let _ = fs::write(
        "tests/unix/conda/.conda/environments.txt",
        format!(
            "{}\n{}",
            conda_one.to_str().unwrap(),
            conda_two.to_str().unwrap()
        ),
    );

    env::set_var("PATH_TEST", conda_dir.clone().to_str().unwrap());
    env::set_var("USER_HOME", conda_dir.clone().to_str().unwrap());
    messaging::clear_rpc_messages();

    conda::find_and_report();

    let conda_exe = conda_dir.clone().join("conda");

    for message in messaging::get_rpc_messages().iter().map(|x| x.as_str()) {
        match get_message(message).as_str() {
            "envManager" => {
                let conda: messaging::EnvManagerMessage = serde_json::from_str(message).unwrap();
                assert_eq!(conda.params.executable_path, conda_exe.to_str().unwrap());
            }
            "pythonEnvironment" => {
                let env: messaging::PythonEnvironmentMessage =
                    serde_json::from_str(message).unwrap();

                assert_eq!(env.params.category, "conda");
                if env.params.name == "envs/one" {
                    assert_eq!(env.params.version.unwrap(), "10.0.1".to_string());
                    assert_eq!(
                        env.params.python_executable_path,
                        conda_one.join("python").to_str().unwrap()
                    );
                    assert_eq!(env.params.env_path.unwrap(), conda_one.to_str().unwrap());
                    assert_eq!(
                        env.params.activated_run.unwrap(),
                        [
                            conda_exe.to_str().unwrap(),
                            "run",
                            "-n",
                            "envs/one",
                            "python"
                        ]
                    );
                } else if env.params.name == "envs/two" {
                    assert!(env.params.version.is_none());
                    assert_eq!(
                        env.params.python_executable_path,
                        conda_two.join("python").to_str().unwrap()
                    );
                    assert_eq!(env.params.env_path.unwrap(), conda_two.to_str().unwrap());
                    assert_eq!(
                        env.params.activated_run.unwrap(),
                        [
                            conda_exe.to_str().unwrap(),
                            "run",
                            "-n",
                            "envs/two",
                            "python"
                        ]
                    );
                } else {
                    panic!("Unexpected environment name");
                }
            }
            _ => panic!("Unexpected message type"),
        }
    }
}
