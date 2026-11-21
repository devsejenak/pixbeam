# Pixbeam

Send files from your screen to your phone through the camera. No internet, no cables, no app.

Open it on the browser, pick a file, and point your phone's camera at the screen. The file plays as animated color codes, and the phone rebuilds it from what it sees. Everything runs in the browser and nothing leaves your devices.

Try it: [tools.devsejenak.com/pixbeam](https://tools.devsejenak.com/pixbeam)

## How it works

1. The file is compressed, split into blocks, and encoded with a fountain code (LT), so the phone can rebuild it from any frames it catches.
2. Each packet gets a header and a CRC32, then is drawn as colored cells (1, 2, or 3 bits per cell).
3. Every frame has corner markers, alignment markers, and a color palette row for calibration.
4. The receiver tracks the markers, straightens the image on the GPU (WebGL2), reads the colors, checks the CRC, and assembles the file.

## Install

```bash
npm install pixbeam
```

The React component needs `react` and `react-dom` 18 or newer.

## Usage

```tsx
import { Pixbeam } from 'pixbeam/react'
import 'pixbeam/style.css'

export default function App() {
  return <Pixbeam />
}
```

This gives you the full send and receive UI. Use `#send` or `#receive` in the URL to open a tab directly (the hashes follow the locale, e.g. `#kirim` / `#terima` in Indonesian; the built-in hashes of every locale are always accepted).

### Props

| Prop | Type | Description |
|---|---|---|
| `config` | `Partial<PixbeamConfig>` | Override the defaults below |
| `locale` | `'en' \| 'id'` | Built-in UI language. Default `'en'` |
| `messages` | `DeepPartial<PixbeamMessages>` | Override any UI text on top of `locale` |
| `heading` | `string` | Optional title above the UI |
| `intro` | `string` | Optional text under the title |

### Language

The UI ships in English (`en`) and Indonesian (`id`):

```tsx
<Pixbeam locale="id" />
```

Change only the strings you need with `messages`. Anything you leave out falls back to the chosen locale:

```tsx
<Pixbeam
  locale="en"
  messages={{
    tabs: { send: 'Share', sendHash: 'share' },
    send: { start: 'Beam it', sending: (name) => `Beaming ${name}…` },
  }}
/>
```

To add a new language, spread a full `PixbeamMessages` object. `locales.en` is a good starting point, and TypeScript will tell you what is missing:

```ts
import { locales, type PixbeamMessages } from 'pixbeam/react'

const fr: PixbeamMessages = { ...locales.en, numberLocale: 'fr-FR', tabs: { ...locales.en.tabs, send: 'Envoyer' } }
```

Camera errors from `Scanner.start()` are thrown as `ScanError` with a stable `code` (`'no-camera'`, `'no-webgl'`, `'camera-denied'`, `'camera-not-found'`, `'camera-busy'`, `'unknown'`), and the UI shows `messages.receive.errors[code]`.

### Config

| Option | Default | Description |
|---|---|---|
| `defaultPreset` | `'320x180'` | Starting grid size in cells, from `'128x72'` to `'320x180'` |
| `defaultBits` | `1` | Starting bits per cell (1, 2, or 3). Higher is faster but needs a better camera |
| `defaultFps` | `20` | Starting frames per second when sending |
| `maxFps` | `30` | Highest FPS the user can pick |
| `defaultOrientation` | `'portrait'` | `'portrait'` or `'landscape'` |
| `cameraFps` | `30` | Requested camera frame rate |
| `autoZoom` | `true` | Auto zoom starts on (when the camera supports it) |
| `lockExposure` | `true` | Exposure lock starts on, for steadier colors |
| `debug` | `false` | Show the debug panel on the receiver |
| `testPattern` | `false` | Add a test pattern option to the sender |

Settings marked "starting" can still be changed by the user in the UI.

The camera only works over HTTPS or on localhost.

## Development

```bash
pnpm install
pnpm dev               # demo at http://localhost:5173
pnpm test              # camera simulation in Node
pnpm typecheck
pnpm build             # library to dist/
pnpm build:standalone  # single-file dist/pixbeam.html
```

```
src/
  core/      codec with no DOM (layout, fountain, packets, render, detect, decode, receiver)
  web/       WebGL2 source, sender, camera scanner, auto zoom, debug panel
  react/     <Pixbeam /> component and pixbeam.css
  config.ts  defaults and options
  i18n.ts    UI text (en, id) and resolveMessages
demo/        dev page (Vite)
test/        camera simulation
```

Issues and pull requests are welcome.

## License

MIT
