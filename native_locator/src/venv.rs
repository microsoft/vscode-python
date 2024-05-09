// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::{
    messaging::{MessageDispatcher, PythonEnvironment, PythonEnvironmentCategory},
    utils::{self, PythonEnv},
};

pub fn is_venv(env: &PythonEnv) -> bool {
    return utils::find_pyvenv_config_path(&env.executable).is_some();
}

pub fn find_and_report(env: &PythonEnv, dispatcher: &mut impl MessageDispatcher) -> Option<()> {
    if is_venv(env) {
        let env = PythonEnvironment {
            name: match env.path.file_name().to_owned() {
                Some(name) => Some(name.to_string_lossy().to_owned().to_string()),
                None => None,
            },
            python_executable_path: Some(env.executable.clone()),
            category: PythonEnvironmentCategory::Venv,
            version: env.version.clone(),
            env_path: Some(env.path.clone()),
            sys_prefix_path: Some(env.path.clone()),
            env_manager: None,
            python_run_command: Some(vec![env.executable.to_str().unwrap().to_string()]),
            project_path: None,
        };

        dispatcher.report_environment(env);

        return Some(());
    }
    None
}
