# Pixbeam

Kirim file dari layar ke kamera HP lewat animasi kode berwarna, langsung di browser. Tanpa internet, tanpa kabel, tanpa aplikasi.

> Repo ini adalah mirror dari monorepo devsejenak. Kontribusi lewat pull request tetap diterima dan akan dibawa masuk secara manual.

## Cara kerja singkat

1. File dikompres, dipecah jadi blok, lalu dikodekan dengan fountain code (LT).
2. Setiap paket diberi header dan CRC32, lalu digambar sebagai sel warna (1, 2, atau 3 bit per sel).
3. Frame punya 4 marker sudut, alignment marker, dan baris palet kalibrasi.
4. Penerima melacak marker, meluruskan gambar per area di GPU (WebGL2), membaca warna, mengecek CRC, lalu menyusun file dari paket mana pun yang berhasil dibaca.

## Struktur

```
src/
  core/    codec murni tanpa DOM (layout, fountain, packets, render, detect, decode, receiver)
  web/     WebGL2 source, sender, scanner kamera, zoom otomatis, panel debug
  react/   komponen <Pixbeam /> dan pixbeam.css
  config.ts  default dan opsi (debug, pola uji, preset, fps)
demo/      halaman dev (Vite)
test/      simulasi kamera di Node
```

## Pakai sebagai komponen

```tsx
import { Pixbeam } from '@devsejenak/pixbeam/react'
import '@devsejenak/pixbeam/style.css'

<Pixbeam config={{ debug: true, testPattern: true }} />
```

## Perintah

```bash
pnpm dev          # demo di http://localhost:5173
pnpm build        # dist/pixbeam.html (satu file)
pnpm test         # simulasi kamera 1080p
pnpm typecheck
```

Kamera hanya bisa dipakai lewat HTTPS atau localhost.
