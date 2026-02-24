mod commands;

use commands::file::{
    get_default_path, get_unique_file_path, is_binary_file, read_file_with_encoding,
    write_file_with_encoding,
};
use commands::system::get_system_fonts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            read_file_with_encoding,
            write_file_with_encoding,
            get_unique_file_path,
            is_binary_file,
            get_default_path,
            get_system_fonts,
        ])
        .run(tauri::generate_context!())
        .expect("Tauriアプリケーションの起動に失敗しました");
}
