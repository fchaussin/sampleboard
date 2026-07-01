// SPDX-License-Identifier: GPL-3.0-or-later
// Coquille Tauri v2 : enregistrement des plugins uniquement. Aucune logique métier en Rust
// (voir specifications.md §3, §16). SQLite, système de fichiers et dialogue d'import.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application Tauri");
}
