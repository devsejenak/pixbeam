import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8770/pixbeam.html'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',f'--use-file-for-fake-video-capture={sys.argv[1]}','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        errs = []
        desk = await (await b.new_context(viewport={'width':1280,'height':900})).new_page()
        desk.on('pageerror', lambda e: errs.append(str(e)))
        desk.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        await desk.goto(BASE)
        print('DEFAULTS', await desk.evaluate("[document.querySelector('#pb-preset').value, document.querySelector('#pb-bits').value, document.querySelector('#pb-fps').value, document.querySelector('#pb-fps').max, document.querySelector('#pb-orientation').value]"))
        print('HAS debug/fps dropdown', await desk.locator('text=Mode debug').count(), await desk.locator('text=FPS kamera').count(), await desk.locator('text=pola uji').count())
        await desk.screenshot(path='test/out/site-send.png', full_page=False)
        await desk.click('text=Mulai kirim'); await desk.wait_for_timeout(1500)
        print('SEND', (await desk.inner_text('.pb-stats')).replace('\n', ' | '))
        await desk.screenshot(path='test/out/site-sending.png')
        mob = await (await b.new_context(permissions=['camera'], viewport={'width':390,'height':844}, device_scale_factor=3, is_mobile=True)).new_page()
        mob.on('pageerror', lambda e: errs.append(str(e)))
        await mob.goto(BASE + '#terima')
        await mob.wait_for_timeout(500)
        await mob.screenshot(path='test/out/site-receive.png')
        await mob.click('text=Mulai scan')
        for i in range(80):
            await mob.wait_for_timeout(500)
            if await mob.locator('.pb-sheet').count(): break
        print('HUD', (await mob.inner_text('.pb-hud')).replace('\n', ' | '))
        if await mob.locator('.pb-sheet').count(): print('RESULT', (await mob.inner_text('.pb-sheet')).replace('\n', ' | ')[:160])
        await mob.screenshot(path='test/out/site-scan.png')
        print('ERRORS', [e for e in errs if '404' not in e])
        await b.close()
asyncio.run(main())
