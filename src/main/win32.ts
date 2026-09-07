import { basename } from 'node:path'
import koffi from 'koffi'

export type ActiveWindow = {
  pid: number
  processName: string
  windowTitle: string
}

const user32 = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')

const GetForegroundWindow = user32.func('uintptr __stdcall GetForegroundWindow()')
const GetWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(uintptr hWnd)')
const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(uintptr hWnd, uint16 *lpString, int nMaxCount)')
const GetWindowThreadProcessId = user32.func(
  'uint32 __stdcall GetWindowThreadProcessId(uintptr hWnd, _Out_ uint32 *lpdwProcessId)'
)
const LASTINPUTINFO = koffi.struct('LASTINPUTINFO', {
  cbSize: 'uint32',
  dwTime: 'uint32'
})
const GetLastInputInfo = user32.func('int __stdcall GetLastInputInfo(_Inout_ LASTINPUTINFO *plii)')
const GetTickCount = kernel32.func('uint32 __stdcall GetTickCount()')
const OpenProcess = kernel32.func('uintptr __stdcall OpenProcess(uint32 access, int inherit, uint32 pid)')
const QueryFullProcessImageNameW = kernel32.func(
  'int __stdcall QueryFullProcessImageNameW(uintptr hProcess, uint32 flags, uint16 *name, _Inout_ uint32 *size)'
)
const CloseHandle = kernel32.func('int __stdcall CloseHandle(uintptr hObject)')

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000

function readWString(buf: Buffer): string {
  const text = buf.toString('utf16le')
  const z = text.indexOf('\0')
  return (z >= 0 ? text.slice(0, z) : text).trim()
}

export function getIdleMs(): number {
  const info = { cbSize: 8, dwTime: 0 }
  const ok = GetLastInputInfo(info)
  if (!ok) return 0
  const now = GetTickCount() as number
  return Math.max(0, now - info.dwTime)
}

export function getActiveWindow(): ActiveWindow | null {
  const hwnd = GetForegroundWindow() as number
  if (!hwnd) return null

  const pidBuf = [0]
  GetWindowThreadProcessId(hwnd, pidBuf)
  const pid = Number(pidBuf[0] || 0)

  const len = (GetWindowTextLengthW(hwnd) as number) + 2
  const titleBuf = Buffer.alloc(Math.max(len, 2) * 2)
  GetWindowTextW(hwnd, titleBuf, Math.max(len, 2))
  const windowTitle = readWString(titleBuf)

  let processName = pid ? `pid-${pid}` : 'unknown'
  if (pid) {
    const handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) as number
    if (handle) {
      try {
        const chars = 1024
        const nameBuf = Buffer.alloc(chars * 2)
        const size = [chars]
        const ok = QueryFullProcessImageNameW(handle, 0, nameBuf, size)
        if (ok) {
          processName = basename(readWString(nameBuf)) || processName
        }
      } finally {
        CloseHandle(handle)
      }
    }
  }

  return { pid, processName, windowTitle }
}
