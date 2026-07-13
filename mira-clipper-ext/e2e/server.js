/**
 * E2E 测试本地服务器
 * 提供各种测试页面供浏览器访问
 */

import http from 'http';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = 9876;

const pages = {
  '/': `<!DOCTYPE html>
<html><head><title>E2E Test Server</title></head>
<body><h1>Mira Clipper E2E Test Server</h1>
<ul>
  <li><a href="/article">Article Page</a></li>
  <li><a href="/cloudflare">Cloudflare Block</a></li>
  <li><a href="/minimal">Minimal Page</a></li>
</ul></body></html>`,

  '/article': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>深入浅出 React Server Components — 前端技术周刊</title>
  <link rel="canonical" href="https://example.com/article/rsc-deep-dive">
  <link rel="icon" href="https://example.com/favicon.ico">
  <meta property="og:site_name" content="前端技术周刊">
  <meta property="og:image" content="https://cdn.example.com/cover-rsc.png">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.8; }
    h1 { color: #333; }
    img { max-width: 100%; }
    .author { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <article>
    <h1>深入浅出 React Server Components</h1>
    <p class="author">作者：张三 · 发布于 2024-06-15</p>
    <p>React Server Components（RSC）是 React 18 引入的一项重要特性，它允许组件在服务端渲染，而无需向客户端发送多余的 JavaScript。</p>
    <h2>为什么需要 RSC？</h2>
    <p>在传统的 SSR 中，虽然 HTML 是在服务端生成的，但组件的代码仍然需要下载到客户端执行 hydration。RSC 打破了这一限制。</p>
    <img src="https://cdn.example.com/diagram-rsc.png" alt="RSC 架构图">
    <h2>核心概念</h2>
    <ul>
      <li>Server Components 不打包到客户端 bundle</li>
      <li>可以直接访问服务端资源（数据库、文件系统）</li>
      <li>自动代码分割，零配置</li>
    </ul>
    <p>总结来说，RSC 让 React 应用获得了更好的首屏性能和更小的 bundle 体积。</p>
  </article>
  <script>
    // 模拟一些动态内容
    document.addEventListener('DOMContentLoaded', () => {
      const footer = document.createElement('footer');
      footer.textContent = '© 前端技术周刊';
      document.body.appendChild(footer);
    });
  </script>
</body>
</html>`,

  '/cloudflare': `<!DOCTYPE html>
<html>
<head><title>Just a moment...</title></head>
<body>
  <div class="cf-browser-verification">
    <h1>Checking your browser before accessing the site.</h1>
    <p>This process is automatic. Your browser will redirect to your requested content shortly.</p>
  </div>
  <form id="challenge-form" action="/cdn-cgi/l/chk_jschl" method="get"></form>
</body>
</html>`,

  '/minimal': `<!DOCTYPE html>
<html><head><title>Minimal</title></head><body>Hello</body></html>`,
};

const server = http.createServer((req, res) => {
  const html = pages[req.url];
  if (html) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`E2E server listening on http://localhost:${port}`);
      resolve({ server, url: `http://localhost:${port}` });
    });
  });
}

export function stopServer() {
  return new Promise((resolve) => server.close(resolve));
}

// 直接运行时启动
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
