import type {
  AnyEngineType,
  VoiceModelStatusResult,
  ModelDownloadOptions,
  ModelDownloadProgressPayload,
  IpcResponse,
} from "../types";
import { modelsDownloadProgressListeners } from "@/components/providers/IpcProvider";

/**
 * Queries voice or music engine models status via IPC ('models:get-status')
 */
export async function getModelStatus(
  engine?: AnyEngineType,
): Promise<IpcResponse<VoiceModelStatusResult>> {
  if (typeof window !== "undefined" && window.ipcRenderer) {
    try {
      const res = (await window.ipcRenderer.invoke("models:get-status", {
        engine,
      })) as IpcResponse<VoiceModelStatusResult>;
      return res;
    } catch (err) {
      console.error("[modelsService] getModelStatus IPC invoke failed:", err);
      return { success: false, error: String(err) };
    }
  }
  return {
    success: false,
    error: "IPC renderer is unavailable in current runtime",
  };
}

/**
 * Downloads a voice engine neural model or all required models via IPC ('models:download')
 */
export async function downloadModel(
  payload: ModelDownloadOptions,
): Promise<IpcResponse<unknown>> {
  if (typeof window !== "undefined" && window.ipcRenderer) {
    try {
      const res = (await window.ipcRenderer.invoke(
        "models:download",
        payload,
      )) as IpcResponse<unknown>;
      return res;
    } catch (err) {
      console.error("[modelsService] downloadModel IPC invoke failed:", err);
      return { success: false, error: String(err) };
    }
  }
  return {
    success: false,
    error: "IPC renderer is unavailable in current runtime",
  };
}

/**
 * Cancels an active model download via IPC ('models:cancel-download')
 */
export async function cancelModelDownload(
  modelId: string,
): Promise<IpcResponse<unknown>> {
  if (typeof window !== "undefined" && window.ipcRenderer) {
    try {
      const res = (await window.ipcRenderer.invoke("models:cancel-download", {
        modelId,
      })) as IpcResponse<unknown>;
      return res;
    } catch (err) {
      console.error(
        "[modelsService] cancelModelDownload IPC invoke failed:",
        err,
      );
      return { success: false, error: String(err) };
    }
  }
  return {
    success: false,
    error: "IPC renderer is unavailable in current runtime",
  };
}

/**
 * Deletes all installed voice engine models from disk via IPC ('models:delete-all')
 */
export async function deleteAllModels(): Promise<IpcResponse<unknown>> {
  if (typeof window !== "undefined" && window.ipcRenderer) {
    try {
      const res = (await window.ipcRenderer.invoke(
        "models:delete-all",
      )) as IpcResponse<unknown>;
      return res;
    } catch (err) {
      console.error("[modelsService] deleteAllModels IPC invoke failed:", err);
      return { success: false, error: String(err) };
    }
  }
  return {
    success: false,
    error: "IPC renderer is unavailable in current runtime",
  };
}

export interface QvacModelInfoData {
  isCached: boolean;
  isLoaded: boolean;
  modelId: string;
  expectedSize: number;
  addon: string;
  [key: string]: unknown;
}

/**
 * Queries QVAC model info (cache/download status) via IPC ('models:get-info')
 */
export async function getModelInfo(
  name: string,
): Promise<IpcResponse<QvacModelInfoData>> {
  if (typeof window !== "undefined" && window.ipcRenderer) {
    try {
      const res = (await window.ipcRenderer.invoke("models:get-info", {
        name,
      })) as IpcResponse<QvacModelInfoData>;
      return res;
    } catch (err) {
      console.error("[modelsService] getModelInfo IPC invoke failed:", err);
      return { success: false, error: String(err) };
    }
  }
  return {
    success: false,
    error: "IPC renderer is unavailable in current runtime",
  };
}

/**
 * Subscribes to neural model download progress events
 */
export function onModelDownloadProgress(
  callback: (payload: ModelDownloadProgressPayload) => void,
): () => void {
  const subId = `model-dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  modelsDownloadProgressListeners.set(subId, callback);
  return () => {
    modelsDownloadProgressListeners.delete(subId);
  };
}
