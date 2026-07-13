// 授权码格式：Base64URL(后端端口).原始授权码
(function () {
  'use strict';

  function encodeBase64Url(value) {
    return btoa(value)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    return atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  }

  window.MiraAuthorizationCode = {
    wrap(port, code) {
      return `${encodeBase64Url(String(port))}.${code}`;
    },
    unwrap(value) {
      const separator = value.indexOf('.');
      if (separator <= 0 || separator === value.length - 1) {
        throw new Error('授权码格式无效，请从 Mira 重新生成');
      }
      const port = Number.parseInt(decodeBase64Url(value.slice(0, separator)), 10);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('授权码中的后端端口无效');
      }
      return {
        backendUrl: `http://127.0.0.1:${port}`,
        code: value.slice(separator + 1),
      };
    },
  };
})();
