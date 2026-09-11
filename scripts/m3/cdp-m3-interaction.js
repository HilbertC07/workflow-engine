/**
 * M3 交互闭环实测 V2（真实浏览器 + CDP 真实鼠标）
 * 数据事实：PENDING 任务全归 1004（赵六），1002 无待办 → 用 1004 验证联动
 * A. 切用户 1001→1004 → /todo 待办联动
 * B. 1001 发起申请 → 出现在我的申请
 * C. 切 1004 → 待办可见新单 → 同意 → 待办消失
 * D. 我的申请：撤回按钮 disabled 状态与 canWithdraw 一致
 */
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')

/** Chrome 路径：换机器 Chrome 装在别处时设 CHROME_PATH 环境变量 */
const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9226
const BASE = process.env.WF_UI_URL || 'http://localhost:5173'
const PROFILE = path.join(os.tmpdir(), 'cdp-profile-m3c')
const OUT = 'm3-interaction-result.txt'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path, timeout: 3000 }, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
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
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
        return
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
  async clickAt(x, y) {
    await this.mouse('mousePressed', x, y); await sleep(60)
    await this.mouse('mouseReleased', x, y); await sleep(350)
  }
  async goto(url) {
    try { await this.send('Page.navigate', { url }, 12000) } catch (e) {}
    await sleep(2600)
  }
  /** 通过 el-select 切用户 */
  async switchUser(userId) {
    const box = await this.evaluate(`(() => {
      const s = document.querySelector('.user-area .el-select')
      if (!s) return null
      const b = s.getBoundingClientRect()
      return { x: Math.round(b.left + b.width/2), y: Math.round(b.top + b.height/2) }
    })()`)
    if (!box) return 'no-select'
    await this.clickAt(box.x, box.y)
    await sleep(800)
    const opts = await this.evaluate(`[...document.querySelectorAll('.el-select-dropdown__item')].map(o => {
      const b = o.getBoundingClientRect()
      return { t: o.textContent.trim(), x: Math.round(b.left+b.width/2), y: Math.round(b.top+b.height/2) }
    })`) || []
    const target = opts.find((o) => o.t.includes(String(userId)))
    if (!target) return 'no-option:' + JSON.stringify(opts.map(o=>o.t))
    await this.clickAt(target.x, target.y)
    await sleep(2200)
    return await this.evaluate(`document.querySelector('.user-area')?.innerText.replace(/\\n/g,' ')`)
  }
  rows(scope) {
    return this.evaluate(`(() => {
      const root = ${scope ? `document.querySelector('${scope}')` : 'document'}
      if (!root) return []
      return [...root.querySelectorAll('.el-table__row')].map(r => r.innerText.replace(/\\n/g,' | '))
    })()`) || []
  }
}

async function main() {
  const out = []
  const log = (s) => { console.log(s); out.push(s) }

  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--window-size=1600,900', 'about:blank',
  ], { stdio: 'ignore' })

  let ready = false
  for (let i = 0; i < 30; i++) { await sleep(700); try { await getJson('/json/version'); ready = true; break } catch {} }
  if (!ready) { log('Chrome 未就绪'); chrome.kill(); process.exit(1) }

  const page = (await getJson('/json/list')).find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }) })
  const cdp = new CDP(ws)
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await sleep(400)

  try {
    // ---------- A ----------
    log('===== A. 切用户 1001 → 1004，/todo 待办联动 =====')
    await cdp.goto(BASE + '/todo')
    log('  初始用户: ' + await cdp.evaluate(`document.querySelector('.user-area')?.innerText.replace(/\\n/g,' ')`))
    log('  初始待办行数: ' + (await cdp.rows()).length)
    log('  切到 1004: ' + await cdp.switchUser(1004))
    log('  切后待办行数: ' + (await cdp.rows()).length)
    log('  待办内容: ' + JSON.stringify((await cdp.rows()).slice(0, 5)))

    // ---------- B ----------
    log('\n===== B. 切回 1001 发起申请 =====')
    await cdp.goto(BASE + '/apply')
    log('  切到 1001: ' + await cdp.switchUser(1001))
    await sleep(1200)

    const procBox = await cdp.evaluate(`(() => {
      const s = document.querySelectorAll('.el-select')[0]
      if (!s) return null
      const b = s.getBoundingClientRect()
      return { x: Math.round(b.left + b.width/2), y: Math.round(b.top + b.height/2) }
    })()`)
    log('  流程下拉: ' + JSON.stringify(procBox))
    if (procBox) {
      await cdp.clickAt(procBox.x, procBox.y); await sleep(900)
      const procs = await cdp.evaluate(`[...document.querySelectorAll('.el-select-dropdown__item')].map(o => {
        const b = o.getBoundingClientRect()
        return { t: o.textContent.trim(), x: Math.round(b.left+b.width/2), y: Math.round(b.top+b.height/2) }
      })`) || []
      log('  可选流程: ' + JSON.stringify(procs.slice(0, 8).map(p => p.t)))
      if (procs.length) { await cdp.clickAt(procs[0].x, procs[0].y); await sleep(900) }
    }
    log('  已选: ' + await cdp.evaluate(`document.querySelectorAll('.el-select')[0]?.innerText.replace(/\\n/g,' ')`))

    // 找标题输入框
    const inputsInfo = await cdp.evaluate(`[...document.querySelectorAll('input')].map(i => ({ ph: i.placeholder, v: i.value, cls: i.className }))`)
    log('  输入框: ' + JSON.stringify(inputsInfo))
    const titleSet = await cdp.evaluate(`(() => {
      const ins = [...document.querySelectorAll('input')]
      const t = ins.find(i => i.placeholder && (i.placeholder.includes('标题') || i.placeholder.includes('title')))
      if (!t) return 'not-found'
      t.value = 'M3交互测试单'
      t.dispatchEvent(new Event('input', { bubbles: true }))
      t.dispatchEvent(new Event('change', { bubbles: true }))
      return t.value
    })()`)
    log('  标题设置: ' + titleSet)
    await sleep(500)

    const submitBox = await cdp.evaluate(`(() => {
      const b = [...document.querySelectorAll('.el-button')].find(x => x.textContent.trim() === '提交申请')
      if (!b) return null
      const r = b.getBoundingClientRect()
      return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }
    })()`)
    if (submitBox) { await cdp.clickAt(submitBox.x, submitBox.y); await sleep(2800) }
    log('  提交提示: ' + JSON.stringify(await cdp.evaluate(`[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim())`)))

    await cdp.goto(BASE + '/my')
    await sleep(1800)
    log('  我的申请首行: ' + JSON.stringify((await cdp.rows()).slice(0, 2)))

    // ---------- C ----------
    log('\n===== C. 切 1004 审批新单 =====')
    await cdp.goto(BASE + '/todo')
    log('  切到 1004: ' + await cdp.switchUser(1004))
    const todoBefore = await cdp.rows()
    log('  审批前待办 (共' + todoBefore.length + '): ' + JSON.stringify(todoBefore.slice(0, 6)))
    const targetIdx = todoBefore.findIndex((t) => t.includes('M3交互测试单'))
    log('  新单在待办中的序号: ' + targetIdx)

    if (targetIdx >= 0) {
      const agreeBtn = await cdp.evaluate(`(() => {
        const rows = [...document.querySelectorAll('.el-table__row')]
        const r = rows[${targetIdx}]
        if (!r) return null
        const b = [...r.querySelectorAll('.el-button')].find(x => x.textContent.trim() === '同意')
        if (!b) return null
        const bb = b.getBoundingClientRect()
        return { x: Math.round(bb.left+bb.width/2), y: Math.round(bb.top+bb.height/2) }
      })()`)
      log('  同意按钮: ' + JSON.stringify(agreeBtn))
      if (agreeBtn) {
        await cdp.clickAt(agreeBtn.x, agreeBtn.y); await sleep(1500)
        log('  弹窗: ' + JSON.stringify(await cdp.evaluate(`document.querySelector('.el-dialog')?.innerText.replace(/\\n/g,' | ').slice(0,200) ?? 'no-dialog'`)))
        const okBtn = await cdp.evaluate(`(() => {
          const d = document.querySelector('.el-dialog')
          if (!d) return null
          const b = [...d.querySelectorAll('.el-button')].find(x => x.textContent.trim() === '确认')
          if (!b) return null
          const r = b.getBoundingClientRect()
          return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }
        })()`)
        log('  确认按钮: ' + JSON.stringify(okBtn))
        if (okBtn) { await cdp.clickAt(okBtn.x, okBtn.y); await sleep(2800) }
        log('  审批提示: ' + JSON.stringify(await cdp.evaluate(`[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim())`)))
        const after = await cdp.rows()
        log('  审批后待办 (共' + after.length + '): ' + JSON.stringify(after.slice(0, 6)))
        log('  新单是否还在待办: ' + after.some((t) => t.includes('M3交互测试单')))
      }
    }

    // ---------- D ----------
    log('\n===== D. 我的申请：撤回按钮 disabled 与 canWithdraw =====')
    await cdp.goto(BASE + '/my')
    await sleep(2000)
    const withdraw = await cdp.evaluate(`(() => {
      return [...document.querySelectorAll('.el-table__row')].slice(0, 12).map(r => {
        const tds = [...r.querySelectorAll('td')]
        const btn = [...r.querySelectorAll('.el-button')].find(b => b.textContent.trim() === '撤回')
        return {
          title: tds[0]?.innerText.trim(),
          status: tds[2]?.innerText.trim(),
          hasBtn: !!btn,
          disabled: btn ? (btn.classList.contains('is-disabled') || btn.disabled === true) : null,
        }
      })
    })()`)
    log('  ' + JSON.stringify(withdraw, null, 1))

    log('\n===== 异常 =====')
    log(cdp.exceptions.length ? JSON.stringify(cdp.exceptions.slice(0, 8)) : '  (无)')
  } catch (e) {
    log('\n!! 脚本中断: ' + e.message)
  }

  fs.writeFileSync(OUT, out.join('\n'), 'utf8')
  try { ws.close() } catch {}
  chrome.kill()
  setTimeout(() => process.exit(0), 300)
}

main().catch((e) => { console.error('脚本异常:', e.message); process.exit(1) })
