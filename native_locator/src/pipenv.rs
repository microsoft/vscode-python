// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::messaging::{MessageDispatcher, PythonEnvironment};
use crate::utils::PythonEnv;
use std::fs;
use std::path::PathBuf;

fn get_pipenv_project(env: &PythonEnv) -> Option<PathBuf> {
    let project_file = env.path.join(".project");
    if project_file.exists() {
        if let Ok(contents) = fs::read_to_string(project_file) {
            let project_folder = PathBuf::from(contents.trim().to_string());
            if project_folder.exists() {
                return Some(project_folder);
            }
        }
    }

    None
}

pub fn find_and_report(env: &PythonEnv, dispatcher: &mut impl MessageDispatcher) -> Option<()> {
    if let Some(project_path) = get_pipenv_project(env) {
        let env = PythonEnvironment::new_pipenv(
            Some(env.executable.clone()),
            env.version.clone(),
            Some(env.path.clone()),
            Some(env.path.clone()),
            None,
            project_path,
        );

        dispatcher.report_environment(env);
        return Some(());
    }

    None
}
