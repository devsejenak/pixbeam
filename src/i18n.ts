import { defaultDebugPanelText, DebugPanelText } from './web/debug-panel'
import { ScanErrorCode } from './web/scanner'

/** Every piece of text the built-in UI shows. Pass a partial copy to `<Pixbeam messages>` to override any of it. */
export interface PixbeamMessages {
  /** BCP 47 tag used for number formatting, e.g. `'en-US'`. */
  numberLocale: string
  tabs: {
    label: string
    send: string
    receive: string
    /** URL hash for each tab, without `#`. Both the configured and built-in hashes are accepted when reading the URL. */
    sendHash: string
    receiveHash: string
  }
  time: {
    underSecond: string
    seconds: (s: number) => string
    minutes: (m: number, s: number) => string
  }
  send: {
    title: string
    defaultText: string
    defaultFileName: string
    file: string
    text: string
    grid: string
    gridOption: (w: number, h: number) => string
    colorMode: string
    bits1: string
    bits2: string
    bits3: string
    orientation: string
    portrait: string
    landscape: string
    speed: string
    speedUnit: string
    testPattern: string
    start: string
    stop: string
    fullscreen: string
    fullscreenUnsupported: string
    empty: string
    needInput: string
    sending: (name: string) => string
    sendingTestPattern: string
    stats: {
      originalSize: string
      sent: string
      compressed: string
      dataPerFrame: string
      packetsPerFrame: string
      eta: string
      actualFps: string
      mode: string
      testPattern: string
    }
  }
  receive: {
    title: string
    intro: string
    autoZoom: string
    lockExposure: string
    start: string
    closeCamera: string
    searching: string
    searchingCorners: string
    matching: string
    locked: (w: number, h: number, colors: number) => string
    msPerFrame: string
    none: string
    exposureLocked: string
    exposureAuto: string
    complete: string
    doneValid: string
    doneInvalid: string
    hud: {
      packets: string
      blocks: string
      valid: string
      time: string
      camera: string
      process: string
      zoom: string
      align: string
      light: string
    }
    result: (size: string, time: string, valid: boolean) => string
    download: string
    again: string
    close: string
    resetMap: string
    copyReport: string
    copied: string
    copyFailed: string
    errors: Record<ScanErrorCode, string>
  }
  debug: DebugPanelText
}

export type PixbeamLocale = 'en' | 'id'

const en: PixbeamMessages = {
  numberLocale: 'en-US',
  tabs: { label: 'Pixbeam mode', send: 'Send', receive: 'Receive', sendHash: 'send', receiveHash: 'receive' },
  time: {
    underSecond: '< 1 s',
    seconds: (s) => `${s} s`,
    minutes: (m, s) => `${m}m ${s}s`,
  },
  send: {
    title: 'Sender',
    defaultText: 'Hello from devsejenak. If this text shows up on your phone, the camera transfer worked.',
    defaultFileName: 'message.txt',
    file: 'File',
    text: 'Or text',
    grid: 'Grid size',
    gridOption: (w, h) => `${w} × ${h} cells`,
    colorMode: 'Color mode',
    bits1: 'Black and white · 1 bit per cell',
    bits2: '4 colors · 2 bits per cell',
    bits3: '8 colors · 3 bits per cell',
    orientation: 'Frame orientation',
    portrait: 'Portrait · phone held upright',
    landscape: 'Landscape · phone held sideways',
    speed: 'Speed',
    speedUnit: 'frames/second',
    testPattern: 'Send test pattern',
    start: 'Start sending',
    stop: 'Stop',
    fullscreen: 'Fullscreen',
    fullscreenUnsupported: 'Fullscreen is not supported in this browser.',
    empty: 'Pick a file or type some text, then press Start sending.',
    needInput: 'Pick a file or type some text first.',
    sending: (name) => `Sending ${name}. Open the Receive tab on your phone.`,
    sendingTestPattern: 'Sending a test pattern. Turn on debug mode on the receiver.',
    stats: {
      originalSize: 'Original size',
      sent: 'Sent',
      compressed: ' (compressed)',
      dataPerFrame: 'Data per frame',
      packetsPerFrame: 'Packets per frame',
      eta: 'Estimated time',
      actualFps: 'Actual FPS',
      mode: 'Mode',
      testPattern: 'test pattern',
    },
  },
  receive: {
    title: 'Receiver',
    intro: "The camera opens fullscreen. Point it at the code on the sender's screen until all four corner markers are visible.",
    autoZoom: 'Auto zoom',
    lockExposure: 'Lock exposure and white balance once locked',
    start: 'Start scanning',
    closeCamera: 'Close camera',
    searching: 'Looking for a code…',
    searchingCorners: 'Looking for the 4 corner markers…',
    matching: 'Markers found, matching settings…',
    locked: (w, h, colors) => `Locked · ${w}×${h} · ${colors} colors`,
    msPerFrame: 'ms/frame',
    none: 'none',
    exposureLocked: 'locked',
    exposureAuto: 'auto',
    complete: 'complete',
    doneValid: 'Done. File received intact.',
    doneInvalid: 'Done, but the checksum failed.',
    hud: {
      packets: 'Packets',
      blocks: 'Blocks',
      valid: 'Valid',
      time: 'Time',
      camera: 'Camera',
      process: 'Process',
      zoom: 'Zoom',
      align: 'Align',
      light: 'Light',
    },
    result: (size, time, valid) => `${size} in ${time} · ${valid ? 'checksum matches' : 'checksum mismatch'}`,
    download: 'Download file',
    again: 'Scan again',
    close: 'Close',
    resetMap: 'Reset map',
    copyReport: 'Copy report',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    errors: {
      'no-camera': 'Camera is not available. Open this page over HTTPS or on localhost.',
      'no-webgl': 'This browser does not support WebGL2.',
      'camera-denied': 'Camera permission was denied. Allow camera access in your browser settings, then try again.',
      'camera-not-found': 'No camera was found on this device.',
      'camera-busy': 'The camera is being used by another app. Close it and try again.',
      unknown: 'Could not open the camera.',
    },
  },
  debug: defaultDebugPanelText,
}

const id: PixbeamMessages = {
  numberLocale: 'id-ID',
  tabs: { label: 'Mode Pixbeam', send: 'Kirim', receive: 'Terima', sendHash: 'kirim', receiveHash: 'terima' },
  time: {
    underSecond: '< 1 dtk',
    seconds: (s) => `${s} dtk`,
    minutes: (m, s) => `${m}m ${s}d`,
  },
  send: {
    title: 'Pengirim',
    defaultText: 'Halo dari devsejenak. Kalau teks ini muncul di HP, berarti transfer lewat kamera berhasil.',
    defaultFileName: 'pesan.txt',
    file: 'File',
    text: 'Atau teks',
    grid: 'Ukuran grid',
    gridOption: (w, h) => `${w} × ${h} sel`,
    colorMode: 'Mode warna',
    bits1: 'Hitam-putih · 1 bit per sel',
    bits2: '4 warna · 2 bit per sel',
    bits3: '8 warna · 3 bit per sel',
    orientation: 'Orientasi frame',
    portrait: 'Portrait · HP dipegang tegak',
    landscape: 'Landscape · HP dipegang miring',
    speed: 'Kecepatan',
    speedUnit: 'frame/detik',
    testPattern: 'Kirim pola uji',
    start: 'Mulai kirim',
    stop: 'Berhenti',
    fullscreen: 'Layar penuh',
    fullscreenUnsupported: 'Layar penuh tidak didukung di browser ini.',
    empty: 'Pilih file atau tulis teks, lalu tekan Mulai kirim.',
    needInput: 'Pilih file atau tulis teks dulu.',
    sending: (name) => `Mengirim ${name}. Buka tab Terima di HP.`,
    sendingTestPattern: 'Mengirim pola uji. Aktifkan mode debug di penerima.',
    stats: {
      originalSize: 'Ukuran asli',
      sent: 'Dikirim',
      compressed: ' (kompres)',
      dataPerFrame: 'Data per frame',
      packetsPerFrame: 'Paket per frame',
      eta: 'Perkiraan waktu',
      actualFps: 'FPS aktual',
      mode: 'Mode',
      testPattern: 'pola uji',
    },
  },
  receive: {
    title: 'Penerima',
    intro: 'Kamera akan terbuka layar penuh. Arahkan ke kode di layar pengirim sampai keempat marker sudut terlihat.',
    autoZoom: 'Zoom otomatis',
    lockExposure: 'Kunci exposure dan white balance saat terkunci',
    start: 'Mulai scan',
    closeCamera: 'Tutup kamera',
    searching: 'Mencari kode…',
    searchingCorners: 'Mencari 4 marker sudut…',
    matching: 'Marker terlihat, mencocokkan pengaturan…',
    locked: (w, h, colors) => `Terkunci · ${w}×${h} · ${colors} warna`,
    msPerFrame: 'ms/frame',
    none: 'tidak ada',
    exposureLocked: 'terkunci',
    exposureAuto: 'auto',
    complete: 'lengkap',
    doneValid: 'Selesai. File diterima utuh.',
    doneInvalid: 'Selesai, tetapi checksum gagal.',
    hud: {
      packets: 'Paket',
      blocks: 'Blok',
      valid: 'Valid',
      time: 'Waktu',
      camera: 'Kamera',
      process: 'Proses',
      zoom: 'Zoom',
      align: 'Align',
      light: 'Cahaya',
    },
    result: (size, time, valid) => `${size} dalam ${time} · ${valid ? 'checksum cocok' : 'checksum tidak cocok'}`,
    download: 'Unduh file',
    again: 'Scan lagi',
    close: 'Tutup',
    resetMap: 'Reset peta',
    copyReport: 'Salin laporan',
    copied: 'Tersalin',
    copyFailed: 'Gagal menyalin',
    errors: {
      'no-camera': 'Kamera tidak tersedia. Buka halaman ini lewat HTTPS atau localhost.',
      'no-webgl': 'Browser ini tidak mendukung WebGL2.',
      'camera-denied': 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.',
      'camera-not-found': 'Tidak ada kamera di perangkat ini.',
      'camera-busy': 'Kamera sedang dipakai aplikasi lain. Tutup aplikasinya lalu coba lagi.',
      unknown: 'Kamera tidak bisa dibuka.',
    },
  },
  debug: {
    waiting: 'Menunggu frame terkunci…',
    mode: 'Mode',
    modeExact: 'pola uji (per sel)',
    modePacket: 'per paket (perkiraan)',
    cellError: 'Error sel',
    centerEdge: 'Tengah / tepi',
    shift: 'Arah geser',
    swapped: 'Tertukar',
    colors: {
      3: ['hitam', 'biru', 'hijau', 'cyan', 'merah', 'magenta', 'kuning', 'putih'],
      2: ['putih', 'merah', 'hijau', 'biru'],
      1: ['hitam', 'putih'],
    },
    hints: {
      rows: ['atas', 'tengah', 'bawah'],
      cols: ['kiri', 'tengah', 'kanan'],
      area: (row, col) => `${row} ${col}`,
      clean: 'Hampir tanpa error. Grid bisa dinaikkan atau fps dipercepat.',
      geometry: 'Error berupa sel yang bergeser ke arah yang sama di tiap area: masalah geometri, misalnya distorsi lensa atau marker kurang presisi. Alignment marker tambahan akan membantu.',
      cluster: (times) => `Error terkumpul di satu area (${times}× rata-rata): biasanya pantulan cahaya, bagian yang tidak fokus, atau distorsi lokal. Lihat bentuknya di peta.`,
      edge: 'Error menumpuk di tepi: kemungkinan distorsi lensa atau cahaya tepi layar lebih gelap.',
      center: 'Error menumpuk di tengah: kemungkinan pantulan cahaya, fokus, atau layar tidak rata.',
      spread: 'Error tersebar merata: lebih mungkin masalah warna, blur, atau sel terlalu kecil.',
      worstArea: (area) => `Area terburuk: ${area}.`,
      someArea: (area) => `Area: ${area}.`,
      confusion: (from, to) => `Warna yang paling sering tertukar: ${from} terbaca ${to}.`,
      usePattern: 'Untuk peta per sel yang akurat, aktifkan Pola uji di pengirim.',
    },
  },
}

/** Built-in translations. */
export const locales: Record<PixbeamLocale, PixbeamMessages> = { en, id }

export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype

function merge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) out[k] = merge(out[k], v)
  return out as T
}

/** Picks a built-in locale (English by default) and applies any overrides on top. */
export function resolveMessages(locale: PixbeamLocale = 'en', overrides?: DeepPartial<PixbeamMessages>): PixbeamMessages {
  return merge(locales[locale] ?? en, overrides)
}
