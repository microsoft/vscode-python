// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use python_finder::{
    known::Environment,
    messaging::{EnvManager, MessageDispatcher, PythonEnvironment},
};
use serde_json::Value;
use std::{collections::HashMap, path::PathBuf};

#[allow(dead_code)]
pub fn test_file_path(paths: &[&str]) -> String {
    // let parts: Vec<String> = paths.iter().map(|p| p.to_string()).collect();
    let mut root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    paths.iter().for_each(|p| root.push(p));

    root.to_string_lossy().to_string()
}

#[allow(dead_code)]
pub fn join_test_paths(paths: &[&str]) -> String {
    let path: PathBuf = paths.iter().map(|p| p.to_string()).collect();
    path.to_string_lossy().to_string()
}

pub struct TestDispatcher {
    pub messages: Vec<String>,
}
pub trait TestMessages {
    fn get_messages(&self) -> Vec<String>;
}

#[allow(dead_code)]
pub fn create_test_dispatcher() -> TestDispatcher {
    impl MessageDispatcher for TestDispatcher {
        fn report_environment_manager(&mut self, env: EnvManager) -> () {
            self.messages.push(serde_json::to_string(&env).unwrap());
        }
        fn report_environment(&mut self, env: PythonEnvironment) -> () {
            self.messages.push(serde_json::to_string(&env).unwrap());
        }
        fn exit(&mut self) -> () {
            //
        }
        fn log_debug(&mut self, _message: &str) -> () {}
        fn log_error(&mut self, _message: &str) -> () {}
        fn log_info(&mut self, _message: &str) -> () {}
        fn log_warning(&mut self, _message: &str) -> () {}
    }
    impl TestMessages for TestDispatcher {
        fn get_messages(&self) -> Vec<String> {
            self.messages.clone()
        }
    }
    TestDispatcher {
        messages: Vec::new(),
    }
}
pub struct TestEnvironment {
    vars: HashMap<String, String>,
    home: Option<String>,
    globals_locations: Vec<PathBuf>,
}
#[allow(dead_code)]
pub fn create_test_environment(
    vars: HashMap<String, String>,
    home: Option<String>,
    globals_locations: Vec<PathBuf>,
) -> TestEnvironment {
    impl Environment for TestEnvironment {
        fn get_env_var(&self, key: String) -> Option<String> {
            self.vars.get(&key).cloned()
        }
        fn get_user_home(&self) -> Option<String> {
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
pub fn assert_messages(expected_json: &[Value], dispatcher: &TestDispatcher) {
    let mut expected_json = expected_json.to_vec();
    assert_eq!(
        expected_json.len(),
        dispatcher.messages.len(),
        "Incorrect number of messages"
    );

    if expected_json.len() == 0 {
        return;
    }

    // Ignore the order of the json items when comparing.
    for actual in dispatcher.messages.iter() {
        let actual: serde_json::Value = serde_json::from_str(actual.as_str()).unwrap();

        let mut valid_index: Option<usize> = None;
        for (i, expected) in expected_json.iter().enumerate() {
            if !compare_json(expected, &actual) {
                continue;
            }

            // Ensure we verify using standard assert_eq!, just in case the code is faulty..
            valid_index = Some(i);
            assert_eq!(expected, &actual);
        }
        if let Some(index) = valid_index {
            // This is to ensure we don't compare the same item twice.
            expected_json.remove(index);
        } else {
            // Use traditional assert so we can see the fully output in the test results.
            assert_eq!(expected_json[0], actual);
        }
    }
}
