function parseBackend(urlStr) {
  if (!urlStr) return null
  try {
    const u = new URL(urlStr)
    return {
      protocol: u.protocol.replace(':', ''),
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? '443' : '80'),
      secondaryPath: u.pathname === '/' ? '' : u.pathname.replace(/\/$/, ''),
    }
  } catch {
    return null
  }
}

function injectScript(cfg) {
  const payload = JSON.stringify(cfg)
  return `<script>(function(){var c=${payload};window.__ZASHBOARD_CONFIG__=c;if(!c.hostname)return;var h=location.hash||'';var q=h.indexOf('?')>=0?new URLSearchParams(h.slice(h.indexOf('?')+1)):new URLSearchParams();if(q.get('hostname'))return;try{if(localStorage.getItem('setup/active-uuid'))return}catch(e){}var sp=new URLSearchParams();sp.set('hostname',c.hostname);sp.set('port',c.port);sp.set('protocol',c.protocol);if(c.secret)sp.set('secret',c.secret);if(c.secondaryPath)sp.set('secondaryPath',c.secondaryPath);location.replace(location.pathname+location.search+'#/setup?'+sp.toString())})();</script>`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const parsed = parseBackend(env.DEFAULT_BACKEND_URL || '')
    const cfg = {
      protocol: parsed?.protocol || 'https',
      hostname: parsed?.hostname || '',
      port: parsed?.port || '',
      secondaryPath: parsed?.secondaryPath || '',
      secret: env.BACKEND_SECRET || '',
    }

    if (url.pathname === '/config.json') {
      return Response.json(cfg, {
        headers: { 'cache-control': 'no-store' },
      })
    }

    const asset = await env.ASSETS.fetch(request)
    const ct = asset.headers.get('content-type') || ''
    if (!ct.includes('text/html') || !cfg.hostname) {
      return asset
    }

    const html = await asset.text()
    const inj = injectScript(cfg)
    const next = html.includes('<head>')
      ? html.replace('<head>', `<head>${inj}`)
      : inj + html
    const headers = new Headers(asset.headers)
    headers.set('cache-control', 'no-store')
    return new Response(next, { status: asset.status, headers })
  },
}
