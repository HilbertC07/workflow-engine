/**
 * 完整闭环验证（真实浏览器）：拖 4 节点 → 连 3 线 → 填编码名称 → 保存
 * → 刷新页面 → 填编码 → 加载 → 校验节点数/坐标/连线是否还原
 *
 * 前置：前端 dev server 已在 5173 运行（cd workflow-ui && npm run dev）
 * 换机器：Chrome 装在别处时设 CHROME_PATH 环境变量
 */
const { spawn } = require('child_process')
const http = require('http')
const os = require('os')
const path = require('path')

const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9223
const URL = process.env.WF_DESIGNER_URL || 'http://localhost:5173/designer'
const PROFILE = path.join(os.tmpdir(), 'cdp-profile-wf2')
const CODE = 'ui_full_' + Date.now().toString(36)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function getJson(path) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: PORT, path, timeout: 3000 }, (res) => {
        let d = ''
        res.on('data', (c) => (d += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(d))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.logs = []
    this.exceptions = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
        return
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        this.logs.push(
          `[${msg.params.type}] ${(msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ')}`
        )
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
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error('CDP timeout: ' + method))
        }
      }, 20000)
    })
  }
  async evaluate(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) {
      return { __error: r.exceptionDetails.text + ' | ' + (r.exceptionDetails.exception?.description ?? '') }
    }
    return r.result.value
  }
}

async function main() {
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1600,900',
      URL,
    ],
    { stdio: 'ignore' }
  )

  let version = null
  for (let i = 0; i < 30; i++) {
    await sleep(700)
    try {
      version = await getJson('/json/version')
      break
    } catch {}
  }
  if (!version) {
    console.log('❌ Chrome 未就绪')
    chrome.kill()
    process.exit(1)
  }
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
  await sleep(4000)

  const mouse = (type, x, y) =>
    cdp.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      clickCount: 1,
      // mousePressed/mouseMoved 期间必须保持 buttons=1，否则 LogicFlow 判定鼠标未按下
      buttons: type === 'mouseReleased' ? 0 : 1,
      pointerType: 'mouse',
    })

  const geo = await cdp.evaluate(`(() => {
    const g = document.querySelector('.lf-graph').getBoundingClientRect()
    return { cx: Math.round(g.left + g.width / 2), cy: Math.round(g.top + g.height / 2), w: Math.round(g.width) }
  })()`)
  console.log('画布中心:', geo)

  const xs = [geo.cx - 300, geo.cx - 100, geo.cx + 100, geo.cx + 300]
  const y = geo.cy

  console.log('\n===== 1. 拖入四个节点 =====')
  for (let i = 0; i < 4; i++) {
    const item = await cdp.evaluate(`(() => {
      const it = document.querySelectorAll('.panel-item')[${i}]
      const b = it.getBoundingClientRect()
      return { x: Math.round(b.left + b.width/2), y: Math.round(b.top + b.height/2) }
    })()`)
    await mouse('mousePressed', item.x, item.y)
    await sleep(80)
    await mouse('mouseMoved', item.x + 40, item.y + 30)
    await sleep(60)
    await mouse('mouseMoved', xs[i], y)
    await sleep(120)
    await mouse('mouseReleased', xs[i], y)
    await sleep(250)
  }
  console.log('  节点数 =', await cdp.evaluate(`document.querySelectorAll('.lf-node').length`))

  console.log('\n===== 2. 连三条线（hover 出锚点 → 右锚点拖到左锚点）=====')
  for (let i = 0; i < 3; i++) {
    // 先 hover 源节点，让锚点渲染出来
    await mouse('mouseMoved', xs[i], y)
    await sleep(350)
    const anchors = await cdp.evaluate(`(() => {
      const list = [...document.querySelectorAll('.lf-anchor')]
      return list.map(a => { const b = a.getBoundingClientRect(); return [Math.round(b.left + b.width/2), Math.round(b.top + b.height/2)] })
    })()`)
    const src = anchors.filter((a) => a[0] > xs[i]).sort((a, b) => a[0] - b[0])[0] || [xs[i] + 78, y]
    console.log(`  线${i + 1}: 源锚点=${src}（可见锚点数 ${anchors.length}）`)
    await mouse('mousePressed', src[0], src[1])
    await sleep(120)
    await mouse('mouseMoved', src[0] + 30, y - 5)
    await sleep(80)
    const dragging = await cdp.evaluate(`(() => {
      const lf = window.__wfLf
      const g = document.querySelector('.lf-graph')
      return {
        graphEdges: lf ? lf.graphModel.edges.length : 'no-hook',
        domEdges: g.querySelectorAll('[class*="edge"]').length,
        paths: g.querySelectorAll('path').length,
      }
    })()`)
    console.log(`    拖动中: ${JSON.stringify(dragging)}`)
    // 移到目标节点左锚点位置；若不吸附则退回节点中心
    await mouse('mouseMoved', xs[i + 1] - 78, y)
    await sleep(200)
    await mouse('mouseMoved', xs[i + 1] - 70, y)
    await sleep(400) // 必须留足渲染时间，否则 checkEnd 时 preact state.dragging 仍为 false
    await mouse('mouseReleased', xs[i + 1] - 70, y)
    await sleep(400)
  }
  const edgeCount = await cdp.evaluate(`(() => {
    const g = document.querySelector('.lf-graph')
    return {
      lfEdge: g.querySelectorAll('.lf-edge').length,
      anyEdge: g.querySelectorAll('[class*="edge"]').length,
      paths: g.querySelectorAll('path').length,
    }
  })()`)
  console.log('  连线统计 =', edgeCount)

  console.log('\n===== 3. 填编码/名称并保存 =====')
  await cdp.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.toolbar-input input')]
    const setVal = (el, v) => {
      el.value = v
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    if (inputs[0]) setVal(inputs[0], '${CODE}')
    if (inputs[1]) setVal(inputs[1], 'UI闭环测试')
  })()`)
  await sleep(300)
  const filled = await cdp.evaluate(`[...document.querySelectorAll('.toolbar-input input')].map(i => i.value)`)
  console.log('  输入框内容:', filled)

  const clicked = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('.el-button')].find(b => b.textContent.trim() === '保存')
    if (btn) { btn.click(); return true }
    return false
  })()`)
  await sleep(2000)
  const msg = await cdp.evaluate(`(() => {
    const m = document.querySelector('.el-message')
    return m ? { text: m.textContent.trim(), cls: m.className } : null
  })()`)
  console.log('  保存按钮点击 =', clicked, ' 提示 =', msg)

  console.log('\n===== 4. 刷新页面后重新加载 =====')
  await cdp.send('Page.reload')
  await sleep(5000)
  const afterReload = await cdp.evaluate(`document.querySelectorAll('.lf-node').length`)
  console.log('  刷新后节点数（应为 0）=', afterReload)

  await cdp.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.toolbar-input input')]
    const el = inputs[0]
    if (el) { el.value = '${CODE}'; el.dispatchEvent(new Event('input', { bubbles: true })) }
  })()`)
  await sleep(300)
  await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('.el-button')].find(b => b.textContent.trim() === '加载')
    if (btn) btn.click()
  })()`)
  await sleep(2500)
  const restored = await cdp.evaluate(`(() => {
    const nodes = [...document.querySelectorAll('.lf-node')]
    return {
      nodeCount: nodes.length,
      positions: nodes.map(n => {
        const b = n.getBoundingClientRect()
        return [Math.round(b.left + b.width/2), Math.round(b.top + b.height/2)]
      }),
      fills: nodes.map(n => { const r = n.querySelector('rect'); return r ? r.getAttribute('fill') : null }),
      edges: document.querySelectorAll('.lf-edge').length,
    }
  })()`)
  console.log('  加载结果:', restored)
  console.log('  期望位置:', xs.map((x) => [x, y]))

  const msg2 = await cdp.evaluate(`(() => {
    const m = document.querySelector('.el-message')
    return m ? m.textContent.trim() : null
  })()`)
  console.log('  加载提示 =', msg2)

  console.log('\n===== 5. 异常 =====')
  console.log(cdp.exceptions.length ? cdp.exceptions.slice(0, 10) : '  (无)')

  ws.close()
  chrome.kill()
  setTimeout(() => process.exit(0), 300)
}

main().catch((e) => {
  console.error('脚本异常:', e.message)
  process.exit(1)
})
