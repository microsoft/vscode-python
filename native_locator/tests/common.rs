// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use python_finder::{
    known::Environment,
    locator::LocatorResult,
    messaging::{EnvManager, PythonEnvironment},
};
use serde_json::Value;
use std::{collections::HashMap, path::PathBuf};

#[allow(dead_code)]
pub fn test_file_path(paths: &[&str]) -> PathBuf {
    // let parts: Vec<String> = paths.iter().map(|p| p.to_string()).collect();
    let mut root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    paths.iter().for_each(|p| root.push(p));

    root
}

#[allow(dead_code)]
pub fn join_test_paths(paths: &[&str]) -> PathBuf {
    let path: PathBuf = paths.iter().map(|p| p.to_string()).collect();
    path
}

pub trait TestMessages {
    fn get_messages(&self) -> Vec<String>;
}

pub struct TestEnvironment {
    vars: HashMap<String, String>,
    home: Option<PathBuf>,
    globals_locations: Vec<PathBuf>,
}
#[allow(dead_code)]
pub fn create_test_environment(
    vars: HashMap<String, String>,
    home: Option<PathBuf>,
    globals_locations: Vec<PathBuf>,
) -> TestEnvironment {
    impl Environment for TestEnvironment {
        fn get_env_var(&self, key: String) -> Option<String> {
            self.vars.get(&key).cloned()
        }
        fn get_user_home(&self) -> Option<PathBuf> {
            self.home.clone()
        }
        fn get_know_global_search_locations(&self) -> Vec<PathBuf> {
            self.globals_locations.clone()
        }
    }
    TestEnvironment {
        vars,
        home,
        globals_locations,
    }
}

fn compare_json(expected: &Value, actual: &Value) -> bool {
    if expected == actual {
        return true;
    }

    if expected.is_object() {
        if expected.as_object().is_none() && actual.as_object().is_none() {
            return true;
        }

        if expected.as_object().is_none() && actual.as_object().is_some() {
            return false;
        }
        if expected.as_object().is_some() && actual.as_object().is_none() {
            return false;
        }

        let expected = expected.as_object().unwrap();
        let actual = actual.as_object().unwrap();

        for (key, value) in expected.iter() {
            if !actual.contains_key(key) {
                return false;
            }
            if !compare_json(value, actual.get(key).unwrap()) {
                return false;
            }
        }
        return true;
    }

    if expected.is_array() {
        let expected = expected.as_array().unwrap();
        let actual = actual.as_array().unwrap();

        if expected.len() != actual.len() {
            return false;
        }

        for (i, value) in expected.iter().enumerate() {
            if !compare_json(value, actual.get(i).unwrap()) {
                return false;
            }
        }
        return true;
    }

    false
}

#[allow(dead_code)]
pub fn assert_messages(expected_json: &[Value], actual_json: &[Value]) {
    let mut expected_json = expected_json.to_vec();
    assert_eq!(
        expected_json.len(),
        actual_json.len(),
        "Incorrect number of messages"
    );

    if expected_json.len() == 0 {
        return;
    }

    // Ignore the order of the json items when comparing.
    for actual in actual_json.iter() {
        let mut valid_index: Option<usize> = None;
        for (i, expected) in expected_json.iter().enumerate() {
            if !compare_json(expected, &actual) {
                continue;
            }

            // Ensure we verify using standard assert_eq!, just in case the code is faulty..
            valid_index = Some(i);
            assert_eq!(expected, actual);
        }
        if let Some(index) = valid_index {
            // This is to ensure we don't compare the same item twice.
            expected_json.remove(index);
        } else {
            // Use traditional assert so we can see the fully output in the test results.
            assert_eq!(&expected_json[0], actual);
        }
    }
}

#[allow(dead_code)]
pub fn get_environments_from_result(result: &Option<LocatorResult>) -> Vec<PythonEnvironment> {
    match result {
        Some(environments) => match environments {
            python_finder::locator::LocatorResult::Environments(envs) => envs.clone(),
            _ => vec![],
        },
        None => vec![],
    }
}

#[allow(dead_code)]
pub fn get_managers_from_result(result: &Option<LocatorResult>) -> Vec<EnvManager> {
    match result {
        Some(environments) => match environments {
            python_finder::locator::LocatorResult::Managers(managers) => managers.clone(),
            python_finder::locator::LocatorResult::Environments(envs) => {
                let mut managers: HashMap<String, EnvManager> = HashMap::new();
                envs.iter().for_each(|env| {
                    if let Some(manager) = env.env_manager.clone() {
                        let key = manager.executable_path.to_str().unwrap().to_string();
                        managers.insert(key, manager);
                    }
                });
                managers
                    .values()
                    .map(|m| m.clone())
                    .collect::<Vec<EnvManager>>()
            }
        },
        None => vec![],
    }
}
