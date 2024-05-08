// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::global_virtualenvs::{list_global_virtualenvs, PythonEnv};
use crate::known;
use crate::messaging::{MessageDispatcher, PythonEnvironment};
use std::fs;
use std::path::PathBuf;

fn get_project_folder(env: &PythonEnv) -> Option<String> {
    let project_file = env.path.join(".project");
    if project_file.exists() {
        if let Ok(contents) = fs::read_to_string(project_file) {
            let project_folder = PathBuf::from(contents.trim().to_string());
            if project_folder.exists() {
                return Some(project_folder.to_string_lossy().to_string());
            }
        }
    }

    None
}

pub fn find_and_report(
    dispatcher: &mut impl MessageDispatcher,
    environment: &impl known::Environment,
) -> Option<()> {
    for env in list_global_virtualenvs(environment).iter() {
        if let Some(project_path) = get_project_folder(&env) {
            let env = PythonEnvironment::new_pipenv(
                Some(
                    env.executable
                        .clone()
                        .into_os_string()
                        .to_string_lossy()
                        .to_string(),
                ),
                env.version.clone(),
                Some(
                    env.path
                        .clone()
                        .into_os_string()
                        .to_string_lossy()
                        .to_string(),
                ),
                Some(
                    env.path
                        .clone()
                        .into_os_string()
                        .to_string_lossy()
                        .to_string(),
                ),
                None,
                project_path,
            );

            dispatcher.report_environment(env);
        }
    }

    None
}
