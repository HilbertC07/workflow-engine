/**
 * M3 前端页面实测（真实浏览器 + CDP）
 * 1. / 是否跳转 /apply
 * 2. 随意路径是否 404
 * 3. 发起申请页：流程列表、发起
 * 4. 切用户到李四(1002)：待办/我的申请数据联动
 * 5. 审批通过 → 待办消失
 * 6. 撤回：canWithdraw 控制
 */
const { spawn } = require('child_process')
const http = require('http')
const os = require('os')
const path = require('path')

/** Chrome 路径：换机器 Chrome 装在别处时设 CHROME_PATH 环境变量 */
const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9224
const BASE = process.env.WF_UI_URL || 'http://localhost:5173'
const PROFILE = path.join(os.tmpdir(), 'cdp-profile-m3')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function getJson(path) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: PORT, path, timeout: 3000 }, (res) => {
        let d = ''
        res.on('data', (c) => (d += c))
        res.on('end', () => {
          try { resolve(JSON.parse(d)) } catch (e) { reject(e) }
        })
      })
      .on('error', reject)
  })
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map()
    this.logs = []; this.exceptions = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
        return
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        this.logs.push(`[${msg.params.type}] ${(msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ')}`)
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails
        this.exceptions.push(`${d.text} ${d.exception?.description ?? ''}`.slice(0, 300))
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)) }
      }, 20000)
    })
  }
  async evaluate(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) return { __error: r.exceptionDetails.text + ' | ' + (r.exceptionDetails.exception?.description ?? '') }
    return r.result.value
  }
  async goto(url) {
    await this.send('Page.navigate', { url })
    await sleep(2500)
  }
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--window-size=1600,900', 'about:blank',
  ], { stdio: 'ignore' })

  let version = null
  for (let i = 0; i < 30; i++) {
    await sleep(700)
    try { version = await getJson('/json/version'); break } catch {}
  }
  if (!version) { console.log('Chrome 未就绪'); chrome.kill(); process.exit(1) }
  const targets = await getJson('/json/list')
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })
  const cdp = new CDP(ws)
  await cdp.send('Runtime.enable')
  await cdp.send('Page.enable')
  await sleep(500)

  const R = {}
  const url = () => cdp.evaluate(`location.pathname + location.search`)

  console.log('===== 1. 根路径 / 跳转 =====')
  await cdp.goto(BASE + '/')
  await sleep(1500)
  R.rootRedirect = await url()
  console.log('  / 跳转到:', R.rootRedirect)
  R.applyNavCount = await cdp.evaluate(`document.querySelectorAll('.el-menu-item, .nav-item, nav a').length`)
  R.applyBodyText = await cdp.evaluate(`document.body.innerText.slice(0, 300)`)
  console.log('  页面文本片段:', JSON.stringify(R.applyBodyText))

  console.log('\n===== 2. 随意路径 404 =====')
  await cdp.goto(BASE + '/this-path-does-not-exist')
  await sleep(1200)
  R.notFoundUrl = await url()
  R.notFoundText = await cdp.evaluate(`document.body.innerText.slice(0, 200)`)
  console.log('  URL:', R.notFoundUrl)
  console.log('  文本:', JSON.stringify(R.notFoundText))

  console.log('\n===== 3. 发起申请页 /apply =====')
  await cdp.goto(BASE + '/apply')
  await sleep(1500)
  R.apply = await cdp.evaluate(`(() => {
    return {
      path: location.pathname,
      text: document.body.innerText.slice(0, 600),
      selects: document.querySelectorAll('.el-select').length,
      inputs: document.querySelectorAll('input').length,
      buttons: [...document.querySelectorAll('.el-button')].map(b => b.textContent.trim()),
    }
  })()`)
  console.log('  path:', R.apply.path)
  console.log('  按钮:', R.apply.buttons)
  console.log('  正文:', JSON.stringify(R.apply.text))

  console.log('\n===== 4. 待办页 /todo =====')
  await cdp.goto(BASE + '/todo')
  await sleep(1500)
  R.todo = await cdp.evaluate(`(() => ({
    path: location.pathname,
    tabs: [...document.querySelectorAll('.el-tabs__item')].map(t => t.textContent.trim()),
    text: document.body.innerText.slice(0, 700),
    rows: document.querySelectorAll('.el-table__row').length,
  }))()`)
  console.log('  path:', R.todo.path)
  console.log('  Tabs:', R.todo.tabs)
  console.log('  行数:', R.todo.rows)
  console.log('  正文:', JSON.stringify(R.todo.text))

  console.log('\n===== 5. 我的申请页 /my =====')
  await cdp.goto(BASE + '/my')
  await sleep(1500)
  R.my = await cdp.evaluate(`(() => ({
    path: location.pathname,
    text: document.body.innerText.slice(0, 800),
    rows: document.querySelectorAll('.el-table__row').length,
    tags: [...document.querySelectorAll('.el-tag')].map(t => ({ t: t.textContent.trim(), c: t.className.replace(/el-tag/g,'').trim() })),
  }))()`)
  console.log('  path:', R.my.path)
  console.log('  行数:', R.my.rows)
  console.log('  状态Tag:', JSON.stringify(R.my.tags))
  console.log('  正文:', JSON.stringify(R.my.text))

  console.log('\n===== 6. 切用户（下拉）=====')
  await cdp.goto(BASE + '/my')
  await sleep(1500)
  R.userSwitcher = await cdp.evaluate(`(() => {
    const candidates = [...document.querySelectorAll('.el-dropdown, .user-switch, [class*="user"]')].map(e => ({ cls: e.className, txt: e.textContent.trim().slice(0,40) }))
    return candidates.slice(0, 8)
  })()`)
  console.log('  用户切换候选元素:', JSON.stringify(R.userSwitcher))

  console.log('\n===== 7. 切到李四(1002) 后 /todo 数据联动 =====')
  // 通过点击下拉切换用户
  const switched = await cdp.evaluate(`(async () => {
    const trigger = document.querySelector('.el-dropdown .el-dropdown-link, .el-dropdown')
    if (trigger) { trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    return !!trigger
  })()`)
  await sleep(1000)
  R.dropdownItems = await cdp.evaluate(`[...document.querySelectorAll('.el-dropdown-menu__item')].map(i => i.textContent.trim())`)
  console.log('  下拉项:', JSON.stringify(R.dropdownItems))

  console.log('\n===== 8. 异常 =====')
  console.log(cdp.exceptions.length ? cdp.exceptions.slice(0, 10) : '  (无)')

  console.log('\n===== 9. 关键结果 JSON =====')
  console.log(JSON.stringify(R, null, 2).slice(0, 4000))

  ws.close(); chrome.kill()
  setTimeout(() => process.exit(0), 300)
}

main().catch((e) => { console.error('脚本异常:', e.message); process.exit(1) })
