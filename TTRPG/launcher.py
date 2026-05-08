"""
TTRPG Companion — Game Launcher
Starts a local HTTP server with API proxy support and opens the application in the browser.
"""
import os
import sys
import json
import atexit
import subprocess
import webbrowser
import http.server
import socketserver
import threading
import socket
import urllib.request
import urllib.error

PORT = 8080

# Serve static files from the directory containing index.html
_exe_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
if os.path.isfile(os.path.join(_exe_dir, 'index.html')):
    DIR = _exe_dir
elif hasattr(sys, '_MEIPASS'):
    DIR = sys._MEIPASS
else:
    DIR = os.path.dirname(os.path.abspath(__file__))

# Headers that should not be forwarded
HOP_BY_HOP = {
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailers', 'transfer-encoding', 'upgrade', 'host',
    'x-proxy-target',
}

PID_FILE = os.path.join(DIR, '.ttrpg_server.pid')


def kill_stale_servers():
    """Kill any existing TTRPG servers running on ports PORT..PORT+19."""
    if sys.platform != 'win32':
        return

    try:
        result = subprocess.run(
            ['netstat', '-ano'], capture_output=True, text=True, timeout=5
        )
        # Find PIDs listening on our port range
        pids_to_kill = set()
        for line in result.stdout.split('\n'):
            if 'LISTENING' not in line:
                continue
            for port in range(PORT, PORT + 20):
                if f'127.0.0.1:{port}' in line or f'0.0.0.0:{port}' in line:
                    parts = line.split()
                    pid = parts[-1]
                    if pid.isdigit():
                        pids_to_kill.add(pid)
                    break

        if not pids_to_kill:
            return

        # Kill identified processes (they're on our port range, safe to assume)
        for pid in pids_to_kill:
            try:
                subprocess.run(
                    ['taskkill', '/F', '/PID', pid],
                    capture_output=True, timeout=3
                )
                safe_print(f"  已清理旧进程 PID:{pid}")
            except Exception:
                pass
        if pids_to_kill:
            import time
            time.sleep(0.5)  # Give OS time to release ports
    except Exception:
        pass


def find_free_port(start=PORT):
    """Find a free port starting from `start` by attempting to bind."""
    for port in range(start, start + 20):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    return start


def write_pid(port):
    """Write the server PID and port to a file for cleanup on next start."""
    try:
        with open(PID_FILE, 'w') as f:
            json.dump({'pid': os.getpid(), 'port': port}, f)
    except Exception:
        pass


def remove_pid():
    """Remove the PID file on clean shutdown."""
    try:
        if os.path.exists(PID_FILE):
            os.remove(PID_FILE)
    except Exception:
        pass


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def log_message(self, format, *args):
        msg = format % args
        safe_print(f"  [{self.command}] {self.path} → {msg}")

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'content-type, authorization, x-api-key, x-proxy-target, anthropic-version')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == '/__ttrpg_ping__':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('X-TTRPG-Server', '1')
            self.end_headers()
            self.wfile.write(b'ttrpg-server ok')
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/proxy':
            self._handle_proxy()
        else:
            self.send_response(404)
            self.end_headers()

    def _handle_proxy(self):
        target = self.headers.get('X-Proxy-Target')
        if not target:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing X-Proxy-Target header')
            return

        # Build upstream headers, filtering out hop-by-hop
        upstream_headers = {}
        for key, value in self.headers.items():
            if key.lower() not in HOP_BY_HOP:
                upstream_headers[key] = value

        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length else None

        safe_print(f"  [PROXY] → {target}")
        try:
            req = urllib.request.Request(target, data=body, headers=upstream_headers, method='POST')
            with urllib.request.urlopen(req, timeout=120) as resp:
                safe_print(f"  [PROXY] ← {resp.status}")
                self.send_response(resp.status)
                self.send_header('X-Proxy-Source', 'upstream')
                for key, value in resp.headers.items():
                    if key.lower() not in HOP_BY_HOP:
                        self.send_header(key, value)
                self.end_headers()
                while True:
                    chunk = resp.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except urllib.error.HTTPError as e:
            safe_print(f"  [PROXY] ← upstream error {e.code}")
            # Try to read upstream error body
            upstream_body = b''
            if e.fp:
                upstream_body = e.fp.read()
            # Return the upstream error to the browser as JSON so the UI can show it
            self.send_response(e.code)
            self.send_header('X-Proxy-Source', 'upstream')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_msg = f'upstream api returned {e.code}'
            if upstream_body:
                try:
                    upstream_json = json.loads(upstream_body)
                    if 'error' in upstream_json:
                        error_msg = upstream_json['error'].get('message', error_msg)
                except Exception:
                    text = upstream_body.decode('utf-8', errors='replace')
                    # If the response is HTML, give a generic message instead of showing HTML
                    if text.strip().startswith('<'):
                        error_msg = f'upstream api returned {e.code} (check API endpoint URL)'
                    else:
                        error_msg = text[:300]
            self.wfile.write(json.dumps({'error': {'message': error_msg, 'code': e.code}}).encode())
        except Exception as e:
            safe_print(f"  [PROXY] ← proxy error: {e}")
            self.send_response(502)
            self.send_header('X-Proxy-Source', 'proxy')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': {'message': str(e), 'code': 502}}).encode())


def safe_print(msg):
    """Print safely on Windows consoles that may not support Unicode."""
    try:
        print(msg)
    except UnicodeEncodeError:
        # Fall back to ASCII-safe output
        print(msg.encode('ascii', errors='replace').decode('ascii'))


def main():
    # Clean up any stale server instances from previous runs
    kill_stale_servers()

    port = find_free_port(PORT)
    url = f"http://127.0.0.1:{port}/index.html"

    # Register cleanup on exit
    atexit.register(remove_pid)

    with socketserver.TCPServer(("127.0.0.1", port), ProxyHandler) as httpd:
        server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        server_thread.start()

        write_pid(port)

        safe_print(f"\n  🎲 跑团助手 TTRPG Companion")
        safe_print(f"  ─────────────────────────────")
        safe_print(f"  服务地址: {url}")
        safe_print(f"  按 Ctrl+C 或关闭此窗口退出\n")
        sys.stdout.flush()

        webbrowser.open(url)

        try:
            while True:
                server_thread.join(1)
        except KeyboardInterrupt:
            safe_print("\n  服务已停止。")
            httpd.shutdown()
            remove_pid()


if __name__ == "__main__":
    main()
