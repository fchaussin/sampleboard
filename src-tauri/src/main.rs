// SPDX-License-Identifier: GPL-3.0-or-later
// Empêche l'ouverture d'une console Windows en release. Aucune logique métier ici (voir spec §3).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sampleboard_lib::run()
}
