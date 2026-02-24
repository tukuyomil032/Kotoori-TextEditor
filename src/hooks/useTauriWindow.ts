/**
 * useTauriWindow.ts
 * Tauri ウィンドウの最大化状態管理、ドラッグ対応、クローズ要求フック
 */

import { useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized,
  closeWindow,
} from '../lib/tauri-api';

export interface UseTauriWindowReturn {
  isMaximized: boolean;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Tauri ウィンドウコントロールフック
 * Electron の onWindowMaximize イベントに相当するリスナーを含む
 */
export function useTauriWindow(): UseTauriWindowReturn {
  const [isMaximized, setIsMaximized] = useState(false);

  // 初期状態取得
  useEffect(() => {
    isWindowMaximized()
      .then(setIsMaximized)
      .catch(() => {});
  }, []);

  // maximize / unmaximize イベントをリッスン
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    win
      .onResized(() => {
        isWindowMaximized()
          .then(setIsMaximized)
          .catch(() => {});
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const minimize = useCallback(async () => {
    await minimizeWindow();
  }, []);

  const toggleMaximize = useCallback(async () => {
    const next = await toggleMaximizeWindow();
    setIsMaximized(next);
  }, []);

  const close = useCallback(async () => {
    await closeWindow();
  }, []);

  return { isMaximized, minimize, toggleMaximize, close };
}

/**
 * ウィンドウのクローズリクエストをインターセプトするフック
 * Electron の onAutoSaveCheck('close') に相当
 *
 * @param onCloseRequested - 保存確認など、クローズ前に実行するコールバック
 *   コールバックが true を返した場合のみウィンドウを閉じる
 */
export function useTauriCloseRequest(onCloseRequested: () => Promise<boolean>): void {
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    win
      .onCloseRequested(async (event) => {
        // デフォルトのクローズをキャンセルして、コールバックに委譲
        event.preventDefault();
        const shouldClose = await onCloseRequested();
        if (shouldClose) {
          await win.destroy();
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [onCloseRequested]);
}
