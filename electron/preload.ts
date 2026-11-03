import { ipcRenderer, contextBridge } from 'electron'

// Map to track wrapped listeners so ipcRenderer.off successfully unregisters them
const listenerMap = new Map<string, Map<(...args: any[]) => void, (event: any, ...args: any[]) => void>>()

function getOrCreateChannelMap(channel: string) {
  let map = listenerMap.get(channel)
  if (!map) {
    map = new Map()
    listenerMap.set(channel, map)
  }
  return map
}

// --------- Expose API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (...args: any[]) => void) {
    const channelMap = getOrCreateChannelMap(channel)
    if (channelMap.has(listener)) {
      return ipcRenderer
    }
    const wrapped = (event: any, ...args: any[]) => listener(event, ...args)
    channelMap.set(listener, wrapped)
    return ipcRenderer.on(channel, wrapped)
  },
  off(channel: string, listener: (...args: any[]) => void) {
    const channelMap = listenerMap.get(channel)
    if (channelMap && channelMap.has(listener)) {
      const wrapped = channelMap.get(listener)!
      channelMap.delete(listener)
      return ipcRenderer.off(channel, wrapped)
    }
    return ipcRenderer.off(channel, listener as any)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})
