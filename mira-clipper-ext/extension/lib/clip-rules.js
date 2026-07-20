/**
 * 触界网站剪藏规则
 *
 * 规则是站点级配置。定位表达式是扩展执行细节，由页面点选流程生成；
 * 未命中规则时，剪藏继续使用默认正文提取器。
 */
(function (global) {
  'use strict';

  const MAX_SELECTOR_LENGTH = 500;
  const MAX_URL_PATTERN_LENGTH = 500;
  const MAX_EXCLUDE_SELECTORS = 20;
  const MAX_EXCLUDE_SELECTOR_LENGTH = 300;
  const MAX_IMAGE_LIMIT = 50;

  function normalizeHostname(value) {
    if (typeof value !== 'string') return '';
    let input = value.trim().toLowerCase();
    if (!input) return '';

    try {
      if (!/^[a-z][a-z\d+.-]*:\/\//i.test(input)) input = `https://${input}`;
      input = new URL(input).hostname;
    } catch (_) {
      input = value.trim().toLowerCase().split('/')[0].split(':')[0];
    }

    return input.replace(/^www\./, '').replace(/\.$/, '');
  }

  function normalizeSelector(value, maxLength = MAX_SELECTOR_LENGTH) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
  }

  function normalizeUrlPattern(value) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, MAX_URL_PATTERN_LENGTH);
  }

  function normalizeUrlPatternMode(value) {
    return value === 'regex' ? 'regex' : 'wildcard';
  }

  function wildcardToRegExp(pattern) {
    let source = '^';
    for (let index = 0; index < pattern.length; index += 1) {
      const character = pattern[index];
      if (character === '*') source += '.*';
      else if (character === '?') source += '.';
      else source += character.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
    }
    return new RegExp(`${source}$`);
  }

  function compileUrlPattern(pattern, mode = 'wildcard') {
    if (!pattern) return null;
    return normalizeUrlPatternMode(mode) === 'regex'
      ? new RegExp(pattern)
      : wildcardToRegExp(pattern);
  }

  function matchesUrlPattern(pattern, url, mode = 'wildcard') {
    if (!pattern) return true;
    if (typeof url !== 'string' || !url) return false;
    try {
      return Boolean(compileUrlPattern(pattern, mode)?.test(url));
    } catch (_) {
      return false;
    }
  }

  function normalizeNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function normalizeRegionSummary(value) {
    if (!value || typeof value !== 'object') return null;
    return {
      tag: normalizeSelector(value.tag, 40),
      text: normalizeSelector(value.text, 120),
      elementCount: normalizeNumber(value.elementCount, 0, 0, 1000000),
      imageCount: normalizeNumber(value.imageCount, 0, 0, 100000),
    };
  }

  function normalizeRule(rule, host) {
    if (!rule || typeof rule !== 'object') return null;
    const normalizedHost = normalizeHostname(host || rule.host);
    if (!normalizedHost) return null;

    const rawExclude = Array.isArray(rule.excludeSelectors)
      ? rule.excludeSelectors
      : typeof rule.excludeSelectors === 'string' ? rule.excludeSelectors.split(/\r?\n/) : [];
    const excludeSelectors = rawExclude
      .map((selector) => normalizeSelector(selector, MAX_EXCLUDE_SELECTOR_LENGTH))
      .filter(Boolean)
      .slice(0, MAX_EXCLUDE_SELECTORS);

    const includeRegion = normalizeRegionSummary(rule.includeRegion);
    const rawExcludeRegions = Array.isArray(rule.excludeRegions) ? rule.excludeRegions : [];
    const excludeRegions = rawExcludeRegions.slice(0, MAX_EXCLUDE_SELECTORS).map((region) => ({
      selector: normalizeSelector(region?.selector, MAX_EXCLUDE_SELECTOR_LENGTH),
      summary: normalizeRegionSummary(region?.summary),
    })).filter((region) => region.selector);

    return {
      host: normalizedHost,
      ...(normalizeUrlPattern(rule.urlPattern) ? {
        urlPattern: normalizeUrlPattern(rule.urlPattern),
        // urlPatternMode was added after the first URL-pattern release. Old
        // records were regular expressions and must keep that meaning.
        urlPatternMode: rule.urlPatternMode === undefined ? 'regex' : normalizeUrlPatternMode(rule.urlPatternMode),
      } : {}),
      enabled: rule.enabled !== false,
      includeSelector: normalizeSelector(rule.includeSelector),
      excludeSelectors,
      ...(includeRegion ? { includeRegion } : {}),
      ...(excludeRegions.length ? { excludeRegions } : {}),
      imagePolicy: {
        minWidth: normalizeNumber(rule.imagePolicy?.minWidth, 100, 0, 10000),
        minHeight: normalizeNumber(rule.imagePolicy?.minHeight, 100, 0, 10000),
        maxCount: normalizeNumber(rule.imagePolicy?.maxCount, 20, 1, MAX_IMAGE_LIMIT),
      },
    };
  }

  function normalizeRules(rules) {
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return {};
    return Object.entries(rules).reduce((result, [host, rule]) => {
      const normalized = normalizeRule(rule, host);
      if (normalized) result[normalized.host] = normalized;
      return result;
    }, {});
  }

  function getRule(rules, hostname, url) {
    const host = normalizeHostname(hostname);
    const normalized = normalizeRules(rules);
    const rule = host && normalized[host] ? normalized[host] : null;
    return rule && matchesUrlPattern(rule.urlPattern, url || hostname, rule.urlPatternMode) ? rule : null;
  }

  function validateRule(rule, host) {
    const normalizedHost = normalizeHostname(host || rule?.host);
    const errors = [];
    if (!normalizedHost || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(normalizedHost)) {
      errors.push('请输入有效的网站域名');
    }
    const rawUrlPattern = typeof rule?.urlPattern === 'string' ? rule.urlPattern.trim() : '';
    const urlPattern = normalizeUrlPattern(rawUrlPattern);
    if (rawUrlPattern) {
      if (rawUrlPattern.length > MAX_URL_PATTERN_LENGTH) errors.push('URL 正则不能超过 500 个字符');
      else {
        try {
          compileUrlPattern(urlPattern, rule?.urlPatternMode);
        } catch (_) {
          errors.push(normalizeUrlPatternMode(rule?.urlPatternMode) === 'regex' ? 'URL 正则格式无效' : 'URL 通配符格式无效');
        }
      }
    }
    if (rule?.includeSelector && rule.includeSelector.length > MAX_SELECTOR_LENGTH) {
      errors.push('正文区域选择器不能超过 500 个字符');
    }
    const excludes = Array.isArray(rule?.excludeSelectors) ? rule.excludeSelectors : [];
    if (excludes.length > MAX_EXCLUDE_SELECTORS) {
      errors.push('排除区域最多 20 条');
    }
    if (excludes.some((selector) => typeof selector !== 'string' || selector.length > MAX_EXCLUDE_SELECTOR_LENGTH)) {
      errors.push('每条排除区域选择器不能超过 300 个字符');
    }
    return { ok: errors.length === 0, errors, host: normalizedHost };
  }

  global.MiraClipRules = {
    MAX_IMAGE_LIMIT,
    MAX_URL_PATTERN_LENGTH,
    normalizeHostname,
    normalizeUrlPattern,
    normalizeUrlPatternMode,
    compileUrlPattern,
    matchesUrlPattern,
    normalizeRule,
    normalizeRules,
    getRule,
    validateRule,
  };
})(this);
