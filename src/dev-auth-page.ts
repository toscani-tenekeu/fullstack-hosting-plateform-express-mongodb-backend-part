type DevAuthPageOptions = {
  publishableKey: string
}

export function renderDevAuthPage({ publishableKey }: DevAuthPageOptions) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hosting Platform Starter Dev Auth</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        font-family: Arial, sans-serif;
        background: #f7f7f7;
        color: #111;
      }

      .wrap {
        max-width: 1100px;
        margin: 0 auto;
      }

      .card {
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }

      button {
        border: 1px solid #ccc;
        border-radius: 8px;
        background: #fff;
        padding: 10px 14px;
        cursor: pointer;
      }

      button.active {
        background: #222;
        color: #fff;
      }

      textarea, pre {
        width: 100%;
        min-height: 150px;
        padding: 12px;
        box-sizing: border-box;
        font-family: monospace;
        font-size: 13px;
        border: 1px solid #ccc;
        border-radius: 8px;
        background: #fafafa;
      }

      #auth-slot {
        min-height: 520px;
      }

      #status {
        margin: 0 0 12px;
        color: #555;
      }

      #error-box {
        display: none;
        white-space: pre-wrap;
        background: #fff4f4;
        border: 1px solid #e7a6a6;
        color: #8d1f1f;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      }

      @media (max-width: 900px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Hosting Platform Starter Dev Auth</h1>
        <p>Use this local page to sign in, mint a dev token, and test backend routes.</p>
      </div>

      <div id="error-box"></div>

      <div class="grid">
        <div class="card">
          <div class="row">
            <button id="tab-sign-in" class="active" type="button">Sign in</button>
            <button id="tab-sign-up" type="button">Sign up</button>
          </div>
          <p id="status">Loading Clerk...</p>
          <div id="auth-slot">Loading authentication UI...</div>
        </div>

        <div>
          <div class="card">
            <h2>Session</h2>
            <div class="row">
              <button id="refresh-token" type="button">Refresh token</button>
              <button id="dev-token" type="button">30m dev token</button>
              <button id="copy-token" type="button">Copy token</button>
              <button id="sign-out" type="button">Sign out</button>
            </div>
            <textarea id="token-output" readonly placeholder="Sign in to get a token"></textarea>
          </div>

          <div class="card">
            <h2>Backend checks</h2>
            <div class="row">
              <button id="call-me-cookie" type="button">GET /api/me with cookie</button>
              <button id="call-me-bearer" type="button">GET /api/me with bearer</button>
              <button id="call-admin" type="button">GET /api/admin/users</button>
            </div>
            <pre id="api-output">No request yet.</pre>
          </div>
        </div>
      </div>
    </div>

    <script>
      window.__DEV_AUTH_CONFIG__ = {
        publishableKey: ${JSON.stringify(publishableKey)},
      }
    </script>
    <script>
      ;(function () {
        const config = window.__DEV_AUTH_CONFIG__
        const authSlot = document.getElementById('auth-slot')
        const tokenOutput = document.getElementById('token-output')
        const apiOutput = document.getElementById('api-output')
        const statusEl = document.getElementById('status')
        const errorBox = document.getElementById('error-box')
        const signInTab = document.getElementById('tab-sign-in')
        const signUpTab = document.getElementById('tab-sign-up')

        function showError(value) {
  errorBox.style.display = 'block'
  if (value instanceof Error) {
    errorBox.textContent = value.message
    return
  }
  errorBox.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

        function clearError() {
          errorBox.style.display = 'none'
          errorBox.textContent = ''
        }

        function setApiOutput(value) {
          apiOutput.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
        }

        function setToken(value) {
          tokenOutput.value = value || ''
        }

        function getMode() {
          return window.location.hash === '#sign-up' ? 'sign-up' : 'sign-in'
        }

        function setMode(mode) {
          window.location.hash = mode === 'sign-up' ? '#sign-up' : '#sign-in'
          void render()
        }

        function updateTabs(mode) {
          signInTab.classList.toggle('active', mode === 'sign-in')
          signUpTab.classList.toggle('active', mode === 'sign-up')
        }

        async function loadScript(src, attributes) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = src
            script.async = true
            script.crossOrigin = 'anonymous'
            Object.entries(attributes || {}).forEach(([key, value]) => {
              script.setAttribute(key, value)
            })
            script.onload = resolve
            script.onerror = () => reject(new Error('Failed to load script: ' + src))
            document.head.appendChild(script)
          })
        }

        function unmount() {
          const authNode = document.getElementById('clerk-auth')
          try {
            if (window.Clerk && authNode) window.Clerk.unmountSignIn(authNode)
          } catch {}
          try {
            if (window.Clerk && authNode) window.Clerk.unmountSignUp(authNode)
          } catch {}
        }

        async function initClerk() {
          if (!config.publishableKey) {
            throw new Error('CLERK_PUBLISHABLE_KEY is missing in .env')
          }

          const parts = config.publishableKey.split('_')
          if (parts.length < 3) {
            throw new Error('Invalid Clerk publishable key format')
          }

          const clerkDomain = atob(parts[2]).slice(0, -1)
          await loadScript('https://' + clerkDomain + '/npm/@clerk/ui@1/dist/ui.browser.js')
          await loadScript('https://' + clerkDomain + '/npm/@clerk/clerk-js@6/dist/clerk.browser.js', {
            'data-clerk-publishable-key': config.publishableKey,
          })

          await window.Clerk.load({
            ui: { ClerkUI: window.__internal_ClerkUICtor },
          })
        }

        async function getToken() {
          if (!window.Clerk || !window.Clerk.session) return ''
          return (await window.Clerk.session.getToken({ skipCache: true })) || ''
        }

        function decodeTokenExpiry(token) {
          if (!token) return null
          try {
            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
            return payload.exp ? new Date(payload.exp * 1000).toLocaleTimeString() : null
          } catch {
            return null
          }
        }

        async function refreshBrowserToken() {
          const token = await getToken()
          setToken(token)
          const expiry = decodeTokenExpiry(token)
          statusEl.textContent = window.Clerk?.isSignedIn
            ? 'Signed in. Browser token expires at: ' + (expiry || 'unknown')
            : 'Not signed in.'
        }

        async function setDevToken() {
  clearError()
  const browserToken = await getToken()

  const response = await fetch('/api/dev/token?expiresInSeconds=1800', {
    credentials: 'include',
    headers: browserToken ? { Authorization: 'Bearer ' + browserToken } : {},
  })

  const body = await response.json()

  if (!response.ok) {
    throw new Error(body?.error?.message || 'Failed to get dev token')
  }

  setToken(body.data.token || '')
  statusEl.textContent = 'Signed in. Dev token expires at: ' + (body.data.expiresAt || 'unknown')
}

        async function callApi(url, mode) {
          try {
            const headers = {}
            if (mode === 'bearer') {
              const token = tokenOutput.value.trim()
              if (!token) throw new Error('No bearer token available')
              headers.Authorization = 'Bearer ' + token
            }

            const response = await fetch(url, {
              credentials: 'include',
              headers,
            })
            const body = await response.json().catch(() => ({ message: 'Non-JSON response' }))
            setApiOutput({ status: response.status, ok: response.ok, body })
          } catch (error) {
            setApiOutput(String(error))
          }
        }

        async function render() {
          clearError()
          const mode = getMode()
          updateTabs(mode)

          if (!window.Clerk) {
            authSlot.textContent = 'Clerk not loaded yet.'
            return
          }

          if (window.Clerk.isSignedIn) {
            unmount()
            authSlot.innerHTML = '<p>You are already signed in. Use the buttons on the right.</p>'
            await refreshBrowserToken()
            return
          }

          authSlot.innerHTML = '<div id="clerk-auth"></div>'
          const node = document.getElementById('clerk-auth')

          const commonProps = {
            appearance: {
              variables: {
                colorPrimary: '#222222',
              },
            },
            fallbackRedirectUrl: '/dev/auth',
            forceRedirectUrl: '/dev/auth',
            oauthFlow: 'auto',
          }

          if (mode === 'sign-up') {
            window.Clerk.mountSignUp(node, {
              ...commonProps,
              signInFallbackRedirectUrl: '/dev/auth#sign-in',
            })
          } else {
            window.Clerk.mountSignIn(node, {
              ...commonProps,
              signUpFallbackRedirectUrl: '/dev/auth#sign-up',
            })
          }

          statusEl.textContent = 'Not signed in.'
          setToken('')
        }

        signInTab.addEventListener('click', () => setMode('sign-in'))
        signUpTab.addEventListener('click', () => setMode('sign-up'))
        document.getElementById('refresh-token').addEventListener('click', () => void refreshBrowserToken().catch(showError))
        document.getElementById('dev-token').addEventListener('click', () => void setDevToken().catch(showError))
        document.getElementById('copy-token').addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(tokenOutput.value)
            setApiOutput('Token copied.')
          } catch (error) {
            showError(String(error))
          }
        })
        document.getElementById('sign-out').addEventListener('click', async () => {
          try {
            if (window.Clerk?.isSignedIn) {
              await window.Clerk.signOut({ redirectUrl: '/dev/auth' })
            }
          } catch (error) {
            showError(String(error))
          }
        })
        document.getElementById('call-me-cookie').addEventListener('click', () => void callApi('/api/me', 'cookie'))
        document.getElementById('call-me-bearer').addEventListener('click', () => void callApi('/api/me', 'bearer'))
        document.getElementById('call-admin').addEventListener('click', () => void callApi('/api/admin/users', 'bearer'))
        window.addEventListener('hashchange', () => void render())

        window.addEventListener('load', async () => {
          try {
            await initClerk()
            await render()
          } catch (error) {
            authSlot.textContent = 'Failed to load Clerk UI.'
            showError(String(error))
            setApiOutput(String(error))
          }
        })
      })()
    </script>
  </body>
</html>`
}
