#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;

struct BackendProcess(Mutex<Option<std::process::Child>>);

#[derive(serde::Serialize, serde::Deserialize)]
struct HealthCheckResult {
    success: bool,
    statusCode: u16,
    error: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct DatabaseHealthResult {
    success: bool,
    ok: bool,
    configured: bool,
    mode: String,
    detail: String,
    vectorStore: VectorStoreInfo,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct VectorStoreInfo {
    ok: bool,
    provider: String,
    detail: String,
    extensionPath: Option<String>,
}

fn get_resource_path() -> PathBuf {
    #[cfg(debug_assertions)]
    {
        PathBuf::from("..").join("server")
    }

    #[cfg(not(debug_assertions))]
    {
        let mut path = std::env::current_exe()
            .expect("Failed to get current exe path");
        path.pop();
        path.pop();
        path.join("resources").join("server")
    }
}

fn get_backend_url() -> String {
    "http://127.0.0.1:8787".to_string()
}

async fn check_backend_health(token: Option<String>) -> Result<HealthCheckResult, String> {
    let client = reqwest::Client::new();
    let mut request = client.get(&format!("{}/health", get_backend_url()));

    if let Some(token) = token {
        if !token.trim().is_empty() {
            request = request.header("Authorization", format!("Bearer {}", token.trim()));
        }
    }

    match request.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            match response.json().await {
                Ok(payload) => {
                    if status == 200 {
                        Ok(HealthCheckResult {
                            success: true,
                            statusCode: status,
                            error: None,
                        })
                    } else {
                        Ok(HealthCheckResult {
                            success: false,
                            statusCode: status,
                            error: Some(payload["message"].as_str().unwrap_or("Unknown error").to_string()),
                        })
                    }
                }
                Err(e) => Ok(HealthCheckResult {
                    success: false,
                    statusCode: status,
                    error: Some(e.to_string()),
                })
            }
        }
        Err(e) => Ok(HealthCheckResult {
            success: false,
            statusCode: 0,
            error: Some(e.to_string()),
        })
    }
}

async fn check_database_health(token: Option<String>) -> Result<DatabaseHealthResult, String> {
    let client = reqwest::Client::new();
    let mut request = client.get(&format!("{}/db/health", get_backend_url()));

    if let Some(token) = token {
        if !token.trim().is_empty() {
            request = request.header("Authorization", format!("Bearer {}", token.trim()));
        }
    }

    match request.send().await {
        Ok(response) => {
            match response.json().await {
                Ok(payload) => {
                    if payload["success"].as_bool().unwrap_or(false) {
                        let data = payload["data"].as_object().unwrap();
                        let vector_store = data["vectorStore"].as_object().unwrap();
                        Ok(DatabaseHealthResult {
                            success: true,
                            ok: data["ok"].as_bool().unwrap_or(false),
                            configured: data["configured"].as_bool().unwrap_or(false),
                            mode: data["mode"].as_str().unwrap_or("unknown").to_string(),
                            detail: data["detail"].as_str().unwrap_or("").to_string(),
                            vectorStore: VectorStoreInfo {
                                ok: vector_store["ok"].as_bool().unwrap_or(false),
                                provider: vector_store["provider"].as_str().unwrap_or("sqlite-vec").to_string(),
                                detail: vector_store["detail"].as_str().unwrap_or("").to_string(),
                                extensionPath: vector_store["extensionPath"].as_str().map(|s| s.to_string()),
                            },
                        })
                    } else {
                        Ok(DatabaseHealthResult {
                            success: false,
                            ok: false,
                            configured: false,
                            mode: "unknown".to_string(),
                            detail: payload["message"].as_str().unwrap_or("Health check failed").to_string(),
                            vectorStore: VectorStoreInfo {
                                ok: false,
                                provider: "sqlite-vec".to_string(),
                                detail: payload["message"].as_str().unwrap_or("Health check failed").to_string(),
                                extensionPath: None,
                            },
                        })
                    }
                }
                Err(e) => Ok(DatabaseHealthResult {
                    success: false,
                    ok: false,
                    configured: false,
                    mode: "unknown".to_string(),
                    detail: e.to_string(),
                    vectorStore: VectorStoreInfo {
                        ok: false,
                        provider: "sqlite-vec".to_string(),
                        detail: e.to_string(),
                        extensionPath: None,
                    },
                })
            }
        }
        Err(e) => Ok(DatabaseHealthResult {
            success: false,
            ok: false,
            configured: false,
            mode: "unknown".to_string(),
            detail: e.to_string(),
            vectorStore: VectorStoreInfo {
                ok: false,
                provider: "sqlite-vec".to_string(),
                detail: e.to_string(),
                extensionPath: None,
            },
        })
    }
}

#[tauri::command]
fn get_backend_url_command() -> String {
    get_backend_url()
}

#[tauri::command]
async fn check_backend_health_command(token: Option<String>) -> Result<HealthCheckResult, String> {
    check_backend_health(token).await
}

#[tauri::command]
async fn check_database_health_command(token: Option<String>) -> Result<DatabaseHealthResult, String> {
    check_database_health(token).await
}

fn start_backend_process() -> Option<std::process::Child> {
    #[cfg(debug_assertions)]
    {
        println!("Dev mode: backend should be started separately");
        return None;
    }

    let server_path = get_resource_path().join("server.cjs");
    let cwd = get_resource_path();

    if !server_path.exists() {
        eprintln!("Backend server not found at: {:?}", server_path);
        return None;
    }

    let node_exe = find_node_executable();
    println!("Starting backend with node: {:?}", node_exe);
    println!("Server path: {:?}", server_path);
    println!("Working directory: {:?}", cwd);

    Command::new(&node_exe)
        .arg(&server_path)
        .current_dir(&cwd)
        .env("HOST", "127.0.0.1")
        .env("PORT", "8787")
        .env("NODE_ENV", "production")
        .env("UI_CHAT_BACKEND_URL", get_backend_url())
        .spawn()
        .ok()
}

fn find_node_executable() -> PathBuf {
    #[cfg(debug_assertions)]
    {
        if let Ok(node) = which::which("node") {
            return node;
        }
    }

    let mut exe_path = std::env::current_exe()
        .expect("Failed to get current exe path");
    exe_path.pop();
    exe_path.pop();
    exe_path.join("resources").join("node-runtime").join("node.exe")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            {
                let process = start_backend_process();
                *app.state::<BackendProcess>().0.lock().unwrap() = process;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_backend_url_command,
            check_backend_health_command,
            check_database_health_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run()
}