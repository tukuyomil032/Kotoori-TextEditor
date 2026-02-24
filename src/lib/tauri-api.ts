/**
 * tauri-api.ts
 * Electron の contextBridge / IPC に相当する Tauri v2 ブリッジ層
 * すべての Tauri invoke / plugin API をここに集約する
 */

import { invoke } from '@tauri-apps/api/core';
import {
  open as dialogOpen,
  save as dialogSave,
  message as dialogMessage,
} from '@tauri-apps/plugin-dialog';
import {
  readText as clipboardReadText,
  writeText as clipboardWriteText,
} from '@tauri-apps/plugin-clipboard-manager';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LazyStore } from '@tauri-apps/plugin-store';

// ─── 型定義 ────────────────────────────────────────────────────────────────────

export type Encoding = 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS';

export interface ReadFileResult {
  content: string;
  encoding: Encoding;
}

// ─── Store の初期化 ────────────────────────────────────────────────────────────

/** アプリ設定用ストア（config.json に対応） */
export const configStore = new LazyStore('config.json', { defaults: {}, autoSave: true });

/** テーマ設定用ストア（mani_theme.json に対応） */
export const themeStore = new LazyStore('mani_theme.json', { defaults: {}, autoSave: true });

/** 見出し設定用ストア（headings.json に対応） */
export const headingStore = new LazyStore('headings.json', { defaults: {}, autoSave: true });

// ─── ファイル操作 ───────────────────────────────────────────────────────────────

/** エンコーディングを自動判別してファイルを読み込む */
export async function readFileWithEncoding(
  filePath: string,
  forcedEncoding?: Encoding
): Promise<ReadFileResult | null> {
  try {
    const result = await invoke<{ content: string; encoding: string }>('read_file_with_encoding', {
      path: filePath,
      forcedEncoding: forcedEncoding ?? null,
    });
    return { content: result.content, encoding: result.encoding as Encoding };
  } catch (e) {
    console.error('[tauri-api] readFileWithEncoding:', e);
    return null;
  }
}

/** エンコーディングを指定してファイルを書き込む */
export async function writeFileWithEncoding(
  filePath: string,
  content: string,
  encoding: Encoding
): Promise<void> {
  await invoke('write_file_with_encoding', { path: filePath, content, encoding });
}

/** ファイルがバイナリかどうかを判定 */
export async function isBinaryFile(filePath: string): Promise<boolean> {
  return invoke<boolean>('is_binary_file', { path: filePath });
}

/** 同名ファイルが存在する場合はタイムスタンプ付きの一意なパスを返す */
export async function getUniqueFilePath(filePath: string): Promise<string> {
  return invoke<string>('get_unique_file_path', { path: filePath });
}

/** Kotoori のデフォルト保存フォルダを取得・作成して返す */
export async function getDefaultPath(): Promise<string> {
  return invoke<string>('get_default_path');
}

/** パスを結合する */
export function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

// ─── ダイアログ ─────────────────────────────────────────────────────────────────

/** ファイルを開くダイアログを表示してパスを返す */
export async function openFileDialog(): Promise<string | null> {
  const result = await dialogOpen({
    filters: [{ name: 'Text Files', extensions: ['txt', 'md', 'js', 'ts', 'json', 'html', 'htm'] }],
    multiple: false,
  });
  return typeof result === 'string' ? result : (result?.[0] ?? null);
}

/** ファイルを保存するダイアログを表示してパスを返す */
export async function saveFileDialog(defaultPath?: string): Promise<string | null> {
  const result = await dialogSave({
    filters: [{ name: 'Text Files', extensions: ['txt', 'html', 'htm', 'md'] }],
    defaultPath,
  });
  return result ?? null;
}

/** フォルダ選択ダイアログを表示してパスを返す */
export async function selectFolderDialog(): Promise<string | null> {
  const result = await dialogOpen({ directory: true, multiple: false });
  return typeof result === 'string' ? result : (result?.[0] ?? null);
}

/** 警告ダイアログを表示する */
export async function showWarningMessage(msg: string, title?: string): Promise<void> {
  await dialogMessage(msg, { title: title ?? '警告', kind: 'warning' });
}

// ─── クリップボード ─────────────────────────────────────────────────────────────

export async function getClipboardText(): Promise<string> {
  try {
    return await clipboardReadText();
  } catch {
    return '';
  }
}

export async function setClipboardText(text: string): Promise<void> {
  await clipboardWriteText(text);
}

// ─── ウィンドウコントロール ─────────────────────────────────────────────────────

/** 現在のウィンドウを最小化する */
export async function minimizeWindow(): Promise<void> {
  await getCurrentWindow().minimize();
}

/** 現在のウィンドウを最大化 / 復元する。現在の最大化状態を返す */
export async function toggleMaximizeWindow(): Promise<boolean> {
  const win = getCurrentWindow();
  const isMaximized = await win.isMaximized();
  if (isMaximized) {
    await win.unmaximize();
    return false;
  } else {
    await win.maximize();
    return true;
  }
}

/** 最大化状態かどうかを返す */
export async function isWindowMaximized(): Promise<boolean> {
  return getCurrentWindow().isMaximized();
}

/** ウィンドウを閉じる */
export async function closeWindow(): Promise<void> {
  await getCurrentWindow().close();
}

// ─── システムフォント ───────────────────────────────────────────────────────────

/** インストール済みフォント一覧を返す */
export async function getSystemFonts(): Promise<string[]> {
  return invoke<string[]>('get_system_fonts');
}

// ─── コンフィグ（旧 readCache / writeCache） ────────────────────────────────────

/** アプリ設定全体を読み込む */
export async function readConfig(): Promise<Record<string, unknown> | null> {
  try {
    const keys = await configStore.keys();
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      result[key] = await configStore.get(key);
    }
    return result;
  } catch {
    return null;
  }
}

/** アプリ設定全体を保存する（既存キーとマージ） */
export async function writeConfig(data: Record<string, unknown>): Promise<boolean> {
  try {
    for (const [key, value] of Object.entries(data)) {
      await configStore.set(key, value);
    }
    await configStore.save();
    return true;
  } catch (e) {
    console.error('[tauri-api] writeConfig:', e);
    return false;
  }
}

/** 設定の特定キーを読み込む */
export async function getConfigValue<T>(key: string): Promise<T | null> {
  return (await configStore.get<T>(key)) ?? null;
}

/** 設定の特定キーを保存する */
export async function setConfigValue(key: string, value: unknown): Promise<void> {
  await configStore.set(key, value);
  await configStore.save();
}

// ─── テーマ設定 ─────────────────────────────────────────────────────────────────

/** テーマ設定を読み込む */
export async function readThemes(): Promise<unknown | null> {
  try {
    return await themeStore.get('themes');
  } catch {
    return null;
  }
}

/** テーマ設定を保存する */
export async function saveThemes(themes: unknown): Promise<boolean> {
  try {
    await themeStore.set('themes', themes);
    await themeStore.save();
    return true;
  } catch (e) {
    console.error('[tauri-api] saveThemes:', e);
    return false;
  }
}

// ─── 見出し設定 ─────────────────────────────────────────────────────────────────

/** 見出し設定を読み込む */
export async function readHeadings(): Promise<unknown | null> {
  try {
    return await headingStore.get('headings');
  } catch {
    return null;
  }
}

/** 見出し設定を保存する */
export async function saveHeadings(headings: unknown): Promise<boolean> {
  try {
    await headingStore.set('headings', headings);
    await headingStore.save();
    return true;
  } catch (e) {
    console.error('[tauri-api] saveHeadings:', e);
    return false;
  }
}
