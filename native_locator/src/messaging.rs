// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::{
    logging::{LogLevel, LogMessage},
    utils::{get_environment_key, get_environment_manager_key, PythonEnv},
};
use env_logger::Builder;
use log::LevelFilter;
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, path::PathBuf, time::UNIX_EPOCH};

pub trait MessageDispatcher {
    fn was_environment_reported(&self, env: &PythonEnv) -> bool;
    fn report_environment_manager(&mut self, env: EnvManager) -> ();
    fn report_environment(&mut self, env: PythonEnvironment) -> ();
    fn exit(&mut self) -> ();
}

#[derive(Serialize, Deserialize, Copy, Clone)]
#[serde(rename_all = "camelCase")]
#[derive(Debug)]
pub enum EnvManagerType {
    Conda,
    Pyenv,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
#[derive(Debug)]
pub struct EnvManager {
    pub executable_path: PathBuf,
    pub version: Option<String>,
    pub tool: EnvManagerType,
    pub company: Option<String>,
    pub company_display_name: Option<String>,
}

impl EnvManager {
    pub fn new(executable_path: PathBuf, version: Option<String>, tool: EnvManagerType) -> Self {
        Self {
            executable_path,
            version,
            tool,
            company: None,
            company_display_name: None,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[derive(Debug)]
pub struct EnvManagerMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: EnvManager,
}

impl EnvManagerMessage {
    pub fn new(params: EnvManager) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "envManager".to_string(),
            params,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
#[derive(Debug)]
pub enum PythonEnvironmentCategory {
    System,
    Homebrew,
    Conda,
    Pyenv,
    PyenvVirtualEnv,
    WindowsStore,
    WindowsRegistry,
    Pipenv,
    VirtualEnvWrapper,
    Venv,
    VirtualEnv,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
#[derive(Debug)]
pub enum Architecture {
    X64,
    X86,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
#[derive(Debug)]
pub struct PythonEnvironment {
    pub display_name: Option<String>,
    pub name: Option<String>,
    pub python_executable_path: Option<PathBuf>,
    pub category: PythonEnvironmentCategory,
    pub version: Option<String>,
    pub env_path: Option<PathBuf>,
    pub env_manager: Option<EnvManager>,
    pub python_run_command: Option<Vec<String>>,
    /**
     * The project path for the Pipenv environment.
     */
    pub project_path: Option<PathBuf>,
    pub arch: Option<Architecture>,
    pub symlinks: Option<Vec<PathBuf>>,
    pub creation_time: Option<u128>,
    pub modified_time: Option<u128>,
    pub company: Option<String>,
    pub company_display_name: Option<String>,
}

impl Default for PythonEnvironment {
    fn default() -> Self {
        Self {
            display_name: None,
            name: None,
            python_executable_path: None,
            category: PythonEnvironmentCategory::System,
            version: None,
            env_path: None,
            env_manager: None,
            python_run_command: None,
            project_path: None,
            arch: None,
            symlinks: None,
            creation_time: None,
            modified_time: None,
            company: None,
            company_display_name: None,
        }
    }
}

impl PythonEnvironment {
    pub fn new(
        display_name: Option<String>,
        name: Option<String>,
        python_executable_path: Option<PathBuf>,
        category: PythonEnvironmentCategory,
        version: Option<String>,
        env_path: Option<PathBuf>,
        env_manager: Option<EnvManager>,
        python_run_command: Option<Vec<String>>,
    ) -> Self {
        Self {
            display_name,
            name,
            python_executable_path,
            category,
            version,
            env_path,
            env_manager,
            python_run_command,
            project_path: None,
            arch: None,
            symlinks: None,
            creation_time: None,
            modified_time: None,
            company: None,
            company_display_name: None,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[derive(Debug)]
pub struct PythonEnvironmentMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: PythonEnvironment,
}

impl PythonEnvironmentMessage {
    pub fn new(params: PythonEnvironment) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "pythonEnvironment".to_string(),
            params,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[derive(Debug)]
pub struct ExitMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: Option<()>,
}

impl ExitMessage {
    pub fn new() -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "exit".to_string(),
            params: None,
        }
    }
}

pub struct JsonRpcDispatcher {
    pub reported_managers: HashSet<String>,
    pub reported_environments: HashSet<String>,
}
pub fn send_message<T: serde::Serialize>(message: T) -> () {
    let message = serde_json::to_string(&message).unwrap();
    print!(
        "Content-Length: {}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n{}",
        message.len(),
        message
    );
}

pub fn initialize_logger(log_level: LevelFilter) {
    Builder::new()
        .format(|_, record| {
            let level = match record.level() {
                log::Level::Debug => LogLevel::Debug,
                log::Level::Error => LogLevel::Error,
                log::Level::Info => LogLevel::Info,
                log::Level::Warn => LogLevel::Warning,
                _ => LogLevel::Debug,
            };
            send_message(LogMessage::new(
                format!("{}", record.args()).to_string(),
                level,
            ));
            Ok(())
        })
        .filter(None, log_level)
        .init();
}

impl JsonRpcDispatcher {}
impl MessageDispatcher for JsonRpcDispatcher {
    fn was_environment_reported(&self, env: &PythonEnv) -> bool {
        if let Some(key) = env.executable.as_os_str().to_str() {
            return self.reported_environments.contains(key);
        }
        false
    }

    fn report_environment_manager(&mut self, env: EnvManager) -> () {
        let key = get_environment_manager_key(&env);
        if !self.reported_managers.contains(&key) {
            self.reported_managers.insert(key);
            send_message(EnvManagerMessage::new(env));
        }
    }
    fn report_environment(&mut self, env: PythonEnvironment) -> () {
        if let Some(key) = get_environment_key(&env) {
            if let Some(ref manager) = env.env_manager {
                self.report_environment_manager(manager.clone());
            }
            if !self.reported_environments.contains(&key) {
                self.reported_environments.insert(key);

                // Get the creation and modified times.
                let mut env = env.clone();
                if let Some(ref exe) = env.python_executable_path {
                    if let Ok(metadata) = exe.metadata() {
                        if let Ok(ctime) = metadata.created() {
                            if let Ok(ctime) = ctime.duration_since(UNIX_EPOCH) {
                                env.creation_time = Some(ctime.as_millis());
                            }
                        }
                        if let Ok(mtime) = metadata.modified() {
                            if let Ok(mtime) = mtime.duration_since(UNIX_EPOCH) {
                                env.modified_time = Some(mtime.as_millis());
                            }
                        }
                    }
                }
                send_message(PythonEnvironmentMessage::new(env));
            }
        }
    }
    fn exit(&mut self) -> () {
        send_message(ExitMessage::new());
    }
}

pub fn create_dispatcher() -> JsonRpcDispatcher {
    JsonRpcDispatcher {
        reported_managers: HashSet::new(),
        reported_environments: HashSet::new(),
    }
}
