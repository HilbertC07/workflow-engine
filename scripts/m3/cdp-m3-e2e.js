/**
 * M3 浏览器端端到端实测（真实 Chrome + CDP 真实鼠标）
 * 场景：1001 发起 M3流程 → 1002 待办可见 → 同意 → 待办消失 → 我的申请状态变化 + 撤回态
 */
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')

/** Chrome 路径：换机器 Chrome 装在别处时设 CHROME_PATH 环境变量 */
const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9227
const BASE = process.env.WF_UI_URL || 'http://localhost:5173'
const PROFILE = path.join(os.tmpdir(), 'cdp-profile-m3d')
const OUT = 'm3-browser-result.txt'
const TITLE = 'M3浏览器闭环 ' + Date.now().toString(36)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path, timeout: 3000 }, (res) => {
      let d = ''; res.on('data', (c) => (d += c))
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.exceptions = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); return
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails
        this.exceptions.push(`${d.text} ${d.exception?.description ?? ''}`.slice(0, 200))
      }
    })
  }
  send(method, params = {}, t = 8000) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout: ' + method)) } }, t)
    })
  }
  async evaluate(expr) {
    try {
      const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false })
      if (r.exceptionDetails) return null
      return r.result.value
    } catch (e) { return null }
  }
  mouse(type, x, y) {
    return this.send('Input.dispatchMouseEvent', {
      type, x, y, button: 'left', clickCount: 1,
      buttons: type === 'mouseReleased' ? 0 : 1, pointerType: 'mouse',
    }).catch(() => {})
  }
  async clickAt(x, y) { await this.mouse('mousePressed', x, y); await sleep(60); await this.mouse('mouseReleased', x, y); await sleep(350) }
  async goto(url) { try { await this.send('Page.navigate', { url }, 12000) } catch (e) {} await sleep(2600) }
  async switchUser(userId) {
    const box = await this.evaluate(`(() => {
      const s = document.querySelector('.user-area .el-select'); if (!s) return null
      const b = s.getBoundingClientRect(); return { x: Math.round(b.left+b.width/2), y: Math.round(b.top+b.height/2) }
    })()`)
    if (!box) return 'no-select'
    await this.clickAt(box.x, box.y); await sleep(800)
    const opts = await this.evaluate(`[...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item')].map(o => {
      const b = o.getBoundingClientRect(); return { t: o.textContent.trim(), x: Math.round(b.left+b.width/2), y: Math.round(b.top+b.height/2) }
    })`) || []
    const t = opts.find((o) => o.t.includes(String(userId)))
    if (!t) return 'no-option'
    await this.clickAt(t.x, t.y); await sleep(2200)
    return await this.evaluate(`document.querySelector('.user-area')?.innerText.replace(/\\n/g,' ')`)
  }
  rows() { return this.evaluate(`[...document.querySelectorAll('.el-table__row')].map(r => r.innerText.replace(/\\n/g,' | '))`) || [] }
}

async function main() {
  const out = []; const log = (s) => { console.log(s); out.push(s) }
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,900', 'about:blank'], { stdio: 'ignore' })

  let ready = false
  for (let i = 0; i < 30; i++) { await sleep(700); try { await getJson('/json/version'); ready = true; break } catch {} }
  if (!ready) { log('Chrome 未就绪'); chrome.kill(); process.exit(1) }
  const page = (await getJson('/json/list')).find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }) })
  const cdp = new CDP(ws)
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable'); await sleep(400)

  try {
    log('===== 1. 1001 在 /apply 发起「' + TITLE + '」 =====')
    await cdp.goto(BASE + '/apply')
    await cdp.switchUser(1001)
    await sleep(1000)

    // 流程选择：定位 label 为「流程」的 form-item 内的 el-select
    const procBox = await cdp.evaluate(`(() => {
      const items = [...document.querySelectorAll('.el-form-item')]
      const item = items.find(i => i.querySelector('.el-form-item__label')?.textContent.includes('流程'))
      if (!item) return null
      const s = item.querySelector('.el-select'); if (!s) return null
      const b = s.getBoundingClientRect(); return { x: Math.round(b.left+b.width/2), y: Math.round(b.top+b.height/2) }
    })()`)
    log('  流程下拉位置: ' + JSON.stringify(procBox))
    if (procBox) {
      await cdp.clickAt(procBox.x, procBox.y); await sleep(1000)
      const procs = await cdp.evaluate(`[...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item')].map(o => {
        const b = o.getBoundingClientRect(); return { t: o.textContent.trim(), x: Math.round(b.left+b.width/2), y: Math.round(b.top+b.height/2) }
      })`) || []
      log('  可选流程: ' + JSON.stringify(procs.map(p => p.t)))
      const leave = procs.find(p => p.t.includes('请假'))
      const pick = leave || procs[0]
      if (pick) { await cdp.clickAt(pick.x, pick.y); await sleep(1000); log('  已选流程: ' + pick.t) }
    }

    const titleVal = await cdp.evaluate(`(() => {
      const t = [...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('申请标题'))
      if (!t) return 'not-found'
      t.value = '${TITLE}'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true }))
      return t.value
    })()`)
    log('  标题: ' + titleVal)
    await sleep(400)

    const subBox = await cdp.evaluate(`(() => {
      const b = [...document.querySelectorAll('.el-button')].find(x => x.textContent.trim() === '提交申请')
      if (!b) return null
      const r = b.getBoundingClientRect(); return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }
    })()`)
    if (subBox) { await cdp.clickAt(subBox.x, subBox.y); await sleep(3000) }
    log('  提交提示: ' + JSON.stringify(await cdp.evaluate(`[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim())`)))
    log('  发起结果卡片: ' + JSON.stringify(await cdp.evaluate(`document.querySelector('.el-descriptions')?.innerText.replace(/\\n/g,' | ') ?? '无'`)))

    // 记录新实例 id
    const newInstId = await cdp.evaluate(`(() => {
      const d = document.querySelector('.el-descriptions')
      if (!d) return null
      const t = d.innerText.match(/实例 ID\\s*\\n?\\s*(\\d+)/)
      return t ? Number(t[1]) : null
    })()`)
    log('  新实例 ID: ' + newInstId)

    log('\n===== 2. 我的申请（1001）新单在最前、可撤回 =====')
    await cdp.goto(BASE + '/my')
    await sleep(2000)
    const myRows = await cdp.evaluate(`[...document.querySelectorAll('.el-table__row')].slice(0, 4).map(r => {
      const tds = [...r.querySelectorAll('td')]
      const btn = [...r.querySelectorAll('.el-button')].find(b => b.textContent.trim() === '撤回')
      return { title: tds[0]?.innerText.trim(), status: tds[2]?.innerText.trim(),
               disabled: btn ? (btn.classList.contains('is-disabled') || btn.disabled === true) : null }
    })`)
    log('  ' + JSON.stringify(myRows, null, 1))

    log('\n===== 3. 切 1002 → 待办应出现该单 =====')
    await cdp.goto(BASE + '/todo')
    log('  切用户: ' + await cdp.switchUser(1002))
    const todoRows = await cdp.rows()
    log('  待办 (' + todoRows.length + '): ' + JSON.stringify(todoRows.slice(0, 6)))
    const idx = todoRows.findIndex((t) => t.includes(TITLE))
    log('  新单序号: ' + idx)

    log('\n===== 4. 点「同意」→ 弹窗 → 确认 =====')
    if (idx >= 0) {
      const agree = await cdp.evaluate(`(() => {
        const r = [...document.querySelectorAll('.el-table__row')][${idx}]
        const b = [...r.querySelectorAll('.el-button')].find(x => x.textContent.trim() === '同意')
        if (!b) return null
        const bb = b.getBoundingClientRect(); return { x: Math.round(bb.left+bb.width/2), y: Math.round(bb.top+bb.height/2) }
      })()`)
      log('  同意按钮: ' + JSON.stringify(agree))
      if (agree) {
        await cdp.clickAt(agree.x, agree.y); await sleep(1600)
        log('  弹窗: ' + JSON.stringify(await cdp.evaluate(`document.querySelector('.el-dialog')?.innerText.replace(/\\n/g,' | ').slice(0,180) ?? '无'`)))
        const ok = await cdp.evaluate(`(() => {
          const d = document.querySelector('.el-dialog'); if (!d) return null
          const b = [...d.querySelectorAll('.el-button')].find(x => x.textContent.trim() === '确认')
          if (!b) return null
          const r = b.getBoundingClientRect(); return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }
        })()`)
        if (ok) { await cdp.clickAt(ok.x, ok.y); await sleep(3000) }
        log('  审批提示: ' + JSON.stringify(await cdp.evaluate(`[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim())`)))
        const after = await cdp.rows()
        log('  审批后待办 (' + after.length + '): ' + JSON.stringify(after.slice(0, 5)))
        log('  新单仍在待办: ' + after.some((t) => t.includes(TITLE)))
      }
    }

    log('\n===== 5. 已办 Tab 应含该单 =====')
    const doneTab = await cdp.evaluate(`(() => {
      const t = [...document.querySelectorAll('.el-tabs__item')].find(x => x.textContent.trim() === '已办')
      if (!t) return null
      const b = t.getBoundingClientRect(); return { x: Math.round(b.left+b.width/2), y: Math.round(b.top+b.height/2) }
    })()`)
    if (doneTab) {
      await cdp.clickAt(doneTab.x, doneTab.y); await sleep(2200)
      const done = await cdp.rows()
      log('  已办 (' + done.length + '): ' + JSON.stringify(done.slice(0, 4)))
      log('  已办含新单: ' + done.some((t) => t.includes(TITLE)))
    }

    log('\n===== 6. 回到 1001 我的申请：状态应为已通过且不可撤回 =====')
    await cdp.goto(BASE + '/my')
    await cdp.switchUser(1001)
    await sleep(1800)
    const final = await cdp.evaluate(`[...document.querySelectorAll('.el-table__row')].slice(0, 3).map(r => {
      const tds = [...r.querySelectorAll('td')]
      const btn = [...r.querySelectorAll('.el-button')].find(b => b.textContent.trim() === '撤回')
      return { title: tds[0]?.innerText.trim(), status: tds[2]?.innerText.trim(),
               disabled: btn ? (btn.classList.contains('is-disabled') || btn.disabled === true) : null }
    })`)
    log('  ' + JSON.stringify(final, null, 1))

    log('\n===== 异常 =====')
    log(cdp.exceptions.length ? JSON.stringify(cdp.exceptions.slice(0, 6)) : '  (无)')
  } catch (e) { log('\n!! 中断: ' + e.message) }

  fs.writeFileSync(OUT, out.join('\n'), 'utf8')
  try { ws.close() } catch {}
  chrome.kill(); setTimeout(() => process.exit(0), 300)
}
main().catch((e) => { console.error('异常:', e.message); process.exit(1) })
