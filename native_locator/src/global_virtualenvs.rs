// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::{
    known,
    utils::{find_python_binary_path, get_version},
};
use std::{fs, path::PathBuf};

fn get_global_virtualenv_dirs(environment: &impl known::Environment) -> Vec<PathBuf> {
    let mut venv_dirs: Vec<PathBuf> = vec![];

    if let Some(work_on_home) = environment.get_env_var("WORKON_HOME".to_string()) {
        if let Ok(work_on_home) = fs::canonicalize(work_on_home) {
            if work_on_home.exists() {
                venv_dirs.push(work_on_home);
            }
        }
    }

    if let Some(home) = environment.get_user_home() {
        let home = PathBuf::from(home);
        for dir in [
            PathBuf::from("envs"),
            PathBuf::from(".direnv"),
            PathBuf::from(".venvs"),
            PathBuf::from(".virtualenvs"),
            PathBuf::from(".local").join("share").join("virtualenvs"),
        ] {
            let venv_dir = home.join(dir);
            if venv_dir.exists() {
                venv_dirs.push(venv_dir);
            }
        }
        if cfg!(target_os = "linux") {
            let envs = PathBuf::from("Envs");
            if envs.exists() {
                venv_dirs.push(envs);
            }
        }
    }

    venv_dirs
}

pub struct PythonEnv {
    pub path: PathBuf,
    pub executable: PathBuf,
    pub version: Option<String>,
}

pub fn list_global_virtualenvs(environment: &impl known::Environment) -> Vec<PythonEnv> {
    let mut python_envs: Vec<PythonEnv> = vec![];
    for root_dir in get_global_virtualenv_dirs(environment).iter() {
        if let Ok(dirs) = fs::read_dir(root_dir) {
            for venv_dir in dirs {
                if let Ok(venv_dir) = venv_dir {
                    let venv_dir = venv_dir.path();
                    if !venv_dir.is_dir() {
                        continue;
                    }
                    if let Some(executable) = find_python_binary_path(&venv_dir) {
                        python_envs.push(PythonEnv {
                            path: venv_dir,
                            executable: executable.clone(),
                            version: get_version(executable.to_str().unwrap()),
                        });
                    }
                }
            }
        }
    }

    python_envs
}
