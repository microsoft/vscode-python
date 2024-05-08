// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::known;
use crate::messaging;
use crate::utils;
use std::env;
use std::path::Path;

fn get_env_path(path: &str) -> Option<String> {
    let path = Path::new(path);
    match path.parent() {
        Some(parent) => {
            if parent.file_name()? == "Scripts" {
                return Some(parent.parent()?.to_string_lossy().to_string());
            } else {
                return Some(parent.to_string_lossy().to_string());
            }
        }
        None => None,
    }
}

fn report_path_python(dispatcher: &mut impl messaging::MessageDispatcher, path: &str) {
    let version = utils::get_version(path);
    let env_path = get_env_path(path);
    dispatcher.report_environment(messaging::PythonEnvironment::new(
        None,
        Some(path.to_string()),
        messaging::PythonEnvironmentCategory::System,
        version,
        env_path.clone(),
        env_path,
        None,
        Some(vec![path.to_string()]),
    ));
}

fn report_python_on_path(
    dispatcher: &mut impl messaging::MessageDispatcher,
    environment: &impl known::Environment,
) {
    if let Some(paths) = environment.get_env_var("PATH".to_string()) {
        let bin = if cfg!(windows) {
            "python.exe"
        } else {
            "python"
        };
        env::split_paths(&paths)
            .map(|p| p.join(bin))
            .filter(|p| p.exists())
            .for_each(|full_path| report_path_python(dispatcher, full_path.to_str().unwrap()));
    }
}

pub fn find_and_report(
    dispatcher: &mut impl messaging::MessageDispatcher,
    environment: &impl known::Environment,
) {
    report_python_on_path(dispatcher, environment);
}
