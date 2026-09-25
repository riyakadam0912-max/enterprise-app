// ==UserScript==
// @name         Client-Side Security Audit (Authorized Testing Only)
// @namespace    https://example.invalid/security-audit
// @version      2.1.0
// @description  Browser-side security checks with safe active probes.
// @match        *://*/*
// @grant        none
// ==/UserScript==

/*
 * AUTHORIZED SECURITY TESTING / EDUCATIONAL USE ONLY
 *
 * Run this script only against applications and accounts you own or have
 * explicit permission to test. This tool performs safe browser-side probes,
 * but it does not submit forms, exploit XSS, change storage, or send
 * state-changing requests. Findings are indicators for manual verification,
 * not proof of exploitability.
 *
 * Browser limitations:
 * - HttpOnly cookies cannot be read from JavaScript.
 * - Response headers may be unavailable when the current page cannot be
 *   fetched because of authentication, CSP, or cross-origin policy.
 * - Static DOM inspection cannot prove whether a value reaches a dangerous
 *   runtime sink.
 */

(function clientSecurityAudit(global) {
  'use strict';

  if (global.document.location.protocol === 'file:') {
    console.warn('[client-security-audit] Not running on a local script file. Paste this script into the live application page or install it as a userscript.');
    return;
  }

  const VERSION = '2.1.0';
  const SENSITIVE_KEY_PATTERN = /(token|jwt|secret|password|passwd|session|auth|credential|api[-_]?key|refresh)/i;
  const SAFE_METHODS = new Set(['GET', 'HEAD', 'DIALOG']);
  const REFLECTION_MARKERS = [
    'client-audit-marker',
    'client_audit_marker',
    'client%2Daudit%2Dmarker',
    'client%22%3E%3Cmarker%3E',
  ];

  function createContext() {
    return {
      findings: [],
      checkedAt: new Date().toISOString(),
      page: global.location.href,
    };
  }

  function addFinding(context, severity, title, evidence, recommendation) {
    context.findings.push({ severity, title, evidence, recommendation });
  }

  function logCheck(name) {
    console.info(`[client-security-audit] ${name}`);
  }

  function getMetaContent(name) {
    const meta = global.document.querySelector(`meta[http-equiv="${name}" i], meta[name="${name}" i]`);
    return meta?.getAttribute('content') || '';
  }

  function hasMeta(name) {
    return Boolean(global.document.querySelector(`meta[http-equiv="${name}" i], meta[name="${name}" i]`));
  }

  function isExternalUrl(value) {
    try {
      return new URL(value, global.location.href).origin !== global.location.origin;
    } catch {
      return false;
    }
  }

  function storageEntries(storage) {
    const entries = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null) entries.push({ key, value: storage.getItem(key) || '' });
    }
    return entries;
  }

  // Finds likely secrets in browser storage without printing their values.
  function checkBrowserStorage(context) {
    logCheck('Checking browser storage and readable cookies');
    for (const [name, storage] of [['localStorage', global.localStorage], ['sessionStorage', global.sessionStorage]]) {
      let entries;
      try {
        entries = storageEntries(storage);
      } catch (error) {
        addFinding(context, 'INFO', `${name} could not be inspected`, String(error), 'Verify storage access manually.');
        continue;
      }

      const sensitiveKeys = entries.filter(({ key }) => SENSITIVE_KEY_PATTERN.test(key));
      if (sensitiveKeys.length > 0) {
        addFinding(
          context,
          'MEDIUM',
          `Potential sensitive data in ${name}`,
          sensitiveKeys.map(({ key }) => key).join(', '),
          'Prefer HttpOnly, Secure, SameSite cookies for session secrets; avoid storing long-lived credentials in script-readable storage.',
        );
      }
    }

    if (global.document.cookie) {
      addFinding(
        context,
        'INFO',
        'Readable cookies are present',
        `${global.document.cookie.split(';').length} cookie(s) are visible to JavaScript.`,
        'Confirm non-sensitive cookies are the only cookies without HttpOnly protection. Secure and SameSite flags require server/header inspection.',
      );
    }
  }

  // Reviews DOM patterns commonly associated with DOM-XSS. It does not execute payloads.
  function checkDomXssIndicators(context) {
    logCheck('Checking DOM-XSS indicators and dangerous markup patterns');
    const inlineHandlers = global.document.querySelectorAll('[onerror], [onclick], [onload], [onmouseover], [onfocus], [oninput], [onchange]');
    const javascriptLinks = [...global.document.querySelectorAll('a[href^="javascript:"]')];
    const rawHtmlAttributes = [...global.document.querySelectorAll('[srcdoc]')];
    const inlineScripts = [...global.document.querySelectorAll('script:not([src])')];

    if (inlineHandlers.length > 0) {
      addFinding(context, 'MEDIUM', 'Inline event handlers detected', `${inlineHandlers.length} element(s) use inline event attributes.`, 'Prefer framework event binding and strict Trusted Types/CSP policies.');
    }
    if (javascriptLinks.length > 0) {
      addFinding(context, 'HIGH', 'javascript: URLs detected', `${javascriptLinks.length} link(s) use executable javascript: URLs.`, 'Replace executable URLs with normal event handlers and validate any dynamic URL values.');
    }
    if (rawHtmlAttributes.length > 0) {
      addFinding(context, 'HIGH', 'srcdoc content detected', `${rawHtmlAttributes.length} iframe(s) use srcdoc.`, 'Audit srcdoc construction and sandbox frames where possible.');
    }
    if (inlineScripts.length > 0) {
      addFinding(context, 'LOW', 'Inline script blocks detected', `${inlineScripts.length} inline script block(s) are present.`, 'Use CSP nonces/hashes and avoid constructing executable code from user-controlled strings.');
    }

    const queryValues = [...new URLSearchParams(global.location.search).values()];
    const hashValue = global.location.hash.slice(1);
    const reflectedValues = [...queryValues, hashValue].filter((value) => value && global.document.body?.textContent?.includes(value));
    if (reflectedValues.length > 0) {
      addFinding(context, 'MEDIUM', 'URL input appears reflected in visible text', `${reflectedValues.length} query/hash value(s) were found in the page text.`, 'Trace the value through rendering and ensure it is inserted with textContent or an equivalent safe encoder.');
    }

    const sourceHints = ['location.search', 'location.hash', 'location.href', 'document.referrer', 'postMessage'];
    const sourceText = [...global.document.scripts].map((script) => script.textContent || '').join('\n');
    const sourceHits = sourceHints.filter((hint) => sourceText.includes(hint));
    if (sourceHits.length > 0) {
      addFinding(context, 'INFO', 'Client-side input sources found in inline scripts', sourceHits.join(', '), 'Trace each source to DOM sinks and ensure values are encoded for the correct output context.');
    }
  }

  // Checks several harmless marker variants already present in the current URL/DOM.
  function checkReflectionVariants(context) {
    logCheck('Checking harmless reflection-marker variants');
    const candidates = [...new URLSearchParams(global.location.search).values(), global.location.hash.slice(1)].filter(Boolean);
    const pageText = global.document.documentElement?.textContent || '';
    const markup = global.document.documentElement?.outerHTML || '';
    const matches = candidates.filter((candidate) => pageText.includes(candidate) || markup.includes(candidate) || markup.includes(decodeURIComponent(candidate)));
    if (matches.length > 0) {
      addFinding(context, 'MEDIUM', 'Audit markers are reflected in the current DOM', matches.join(', '), 'Confirm reflected values are contextually encoded and cannot become HTML, script, URL, or CSS content.');
    }
    if (candidates.length > 0) {
      const encodedVariants = candidates.filter((candidate) => REFLECTION_MARKERS.some((marker) => marker.includes(encodeURIComponent(candidate)) || marker.includes(candidate)));
      if (encodedVariants.length > 0) {
        addFinding(context, 'INFO', 'URL contains audit-like marker variants', encodedVariants.join(', '), 'Manually verify whether the application treats decoded, encoded, quoted, or delimiter-containing input safely.');
      }
    }
  }

  // Inspects forms without submitting them; CSRF protection is application-specific.
  function checkCsrfIndicators(context) {
    logCheck('Checking forms and CSRF indicators without submission');
    const forms = [...global.document.forms];
    const stateChangingForms = forms.filter((form) => !SAFE_METHODS.has((form.method || 'GET').toUpperCase()));
    const missingTokens = stateChangingForms.filter((form) => !form.querySelector('input[name*="csrf" i], input[name*="xsrf" i], input[name*="token" i]'));

    if (missingTokens.length > 0) {
      addFinding(context, 'MEDIUM', 'State-changing forms lack an obvious CSRF token', `${missingTokens.length} of ${stateChangingForms.length} non-GET form(s) have no csrf/xsrf/token field.`, 'Verify server-side CSRF protection, SameSite cookies, and origin checks. A token may also be supplied through a custom header or framework mechanism.');
    }

    const crossOriginActions = forms.filter((form) => form.action && isExternalUrl(form.action));
    if (crossOriginActions.length > 0) {
      addFinding(context, 'MEDIUM', 'Forms submit to another origin', `${crossOriginActions.length} form action(s) are cross-origin.`, 'Confirm this is intentional and that sensitive values are not sent to untrusted origins.');
    }

    const passwordForms = forms.filter((form) => form.querySelector('input[type="password"]'));
    if (global.location.protocol !== 'https:' && passwordForms.length > 0) {
      addFinding(context, 'HIGH', 'Password form is served over a non-HTTPS page', `${passwordForms.length} password form(s) found on ${global.location.protocol}.`, 'Serve authentication and credential entry pages only over HTTPS.');
    }
  }

  async function fetchCurrentHeaders() {
    try {
      const response = await global.fetch(global.location.href, { credentials: 'same-origin', cache: 'no-store' });
      return response.headers;
    } catch {
      return null;
    }
  }

  function checkCsp(context, csp) {
    const normalized = csp.toLowerCase();
    if (!csp) {
      addFinding(context, 'HIGH', 'Content-Security-Policy is missing', 'No CSP response header or http-equiv meta tag was found.', 'Deploy a restrictive CSP with default-src, script-src, object-src, base-uri, and frame-ancestors directives.');
      return;
    }

    if (normalized.includes("'unsafe-inline'") || normalized.includes("'unsafe-eval'") || normalized.includes('*') || normalized.includes('data:') || normalized.includes('blob:')) {
      addFinding(context, 'MEDIUM', 'CSP contains weak directives', csp, 'Remove unsafe-inline/unsafe-eval and broad wildcards where possible; use nonces or hashes for required inline scripts.');
    }
    if (!normalized.includes('script-src')) {
      addFinding(context, 'MEDIUM', 'CSP has no explicit script-src policy', csp, 'Declare script-src explicitly instead of relying only on broad defaults.');
    }
    for (const directive of ['default-src', 'object-src', 'base-uri', 'frame-ancestors']) {
      if (!new RegExp(`(?:^|;)\\s*${directive}\\b`, 'i').test(csp)) {
        addFinding(context, 'LOW', `CSP does not declare ${directive}`, csp, `Add an explicit ${directive} directive appropriate for the application.`);
      }
    }
  }

  // Audits browser-relevant meta tags. HTTP response headers remain authoritative.
  function checkSecurityMetaTags(context) {
    logCheck('Checking security-related meta tags');
    const metaChecks = [
      ['referrer', 'Referrer-Policy meta tag is missing', 'Add a restrictive referrer policy, preferably as an HTTP response header.'],
      ['permissions-policy', 'Permissions-Policy meta tag is missing', 'Configure Permissions-Policy as an HTTP response header; meta support is limited.'],
      ['content-security-policy', 'CSP meta tag is missing', 'Prefer a Content-Security-Policy response header; a meta CSP cannot cover every directive.'],
    ];
    for (const [name, title, recommendation] of metaChecks) {
      if (!hasMeta(name)) addFinding(context, 'LOW', title, `No meta[name="${name}"] or equivalent http-equiv tag was found.`, recommendation);
    }

    if (hasMeta('x-frame-options')) {
      addFinding(context, 'LOW', 'X-Frame-Options is declared in a meta tag', 'X-Frame-Options meta tags are not consistently enforced by browsers.', 'Set X-Frame-Options as an HTTP response header and use CSP frame-ancestors.');
    }

    const metaCsp = getMetaContent('content-security-policy');
    if (metaCsp && !metaCsp.toLowerCase().includes('frame-ancestors')) {
      addFinding(context, 'LOW', 'Meta CSP lacks frame-ancestors', metaCsp, 'Use a response-header CSP with an explicit frame-ancestors policy for clickjacking defense.');
    }
  }

  // Reads defensive response headers. It makes one same-origin GET and never submits a form.
  async function checkSecurityHeaders(context) {
    logCheck('Checking response headers and CSP');
    const headers = await fetchCurrentHeaders();
    const csp = headers?.get('content-security-policy') || getMetaContent('Content-Security-Policy');
    checkCsp(context, csp);

    const checks = [
      ['strict-transport-security', 'HSTS is missing', 'Enable HSTS for HTTPS production deployments.'],
      ['x-content-type-options', 'X-Content-Type-Options is missing', 'Set X-Content-Type-Options: nosniff.'],
      ['referrer-policy', 'Referrer-Policy is missing', 'Set a restrictive Referrer-Policy such as strict-origin-when-cross-origin.'],
      ['permissions-policy', 'Permissions-Policy is missing', 'Declare only the browser capabilities the application needs.'],
    ];
    for (const [header, title, recommendation] of checks) {
      if (!headers?.get(header) && !getMetaContent(header)) addFinding(context, 'LOW', title, 'Header was not observable from the current page.', recommendation);
    }
    if (!headers?.get('x-frame-options') && !csp.toLowerCase().includes('frame-ancestors')) {
      addFinding(context, 'MEDIUM', 'Clickjacking protection is missing', 'Neither X-Frame-Options nor CSP frame-ancestors was observed.', 'Set CSP frame-ancestors and/or X-Frame-Options as appropriate.');
    }
  }

  function checkMixedContent(context) {
    logCheck('Checking mixed-content and insecure resource references');
    if (global.location.protocol !== 'https:') return;
    const insecureResources = [...global.document.querySelectorAll('[src], [href], form[action]')].filter((element) => {
      const value = element.getAttribute('src') || element.getAttribute('href') || element.getAttribute('action') || '';
      return value.startsWith('http://');
    });
    if (insecureResources.length > 0) addFinding(context, 'MEDIUM', 'Mixed-content references detected', `${insecureResources.length} http:// resource or form reference(s).`, 'Use HTTPS URLs or same-origin relative URLs.');
  }

  function checkCredentialExposure(context) {
    logCheck('Checking credential autocomplete and third-party resources');
    const passwordInputs = [...global.document.querySelectorAll('input[type="password"]')];
    const weakAutocomplete = passwordInputs.filter((input) => ['off', 'false'].includes((input.getAttribute('autocomplete') || '').toLowerCase()));
    if (weakAutocomplete.length > 0) {
      addFinding(context, 'LOW', 'Password fields use weak autocomplete guidance', `${weakAutocomplete.length} password field(s) use autocomplete=off/false.`, 'Use current-password or new-password where appropriate instead of attempting to disable password managers.');
    }

    const thirdPartyScripts = [...global.document.scripts].filter((script) => script.src && isExternalUrl(script.src));
    if (thirdPartyScripts.length > 0) {
      addFinding(context, 'LOW', 'Third-party scripts are loaded', thirdPartyScripts.map((script) => script.src).slice(0, 10).join(', '), 'Inventory and pin third-party scripts; use SRI where compatible and review their access to page data.');
    }
  }

  function checkMessagingAndFrames(context) {
    logCheck('Checking postMessage, iframe, and framing indicators');
    const externalFrames = [...global.document.querySelectorAll('iframe[src]')].filter((frame) => isExternalUrl(frame.getAttribute('src')));
    const unsandboxedFrames = [...global.document.querySelectorAll('iframe[src]')].filter((frame) => !frame.hasAttribute('sandbox'));
    if (externalFrames.length > 0) addFinding(context, 'MEDIUM', 'External iframes are embedded', `${externalFrames.length} external iframe(s) found.`, 'Review frame origins, permissions, sandbox settings, and data exposure across embedded content.');
    if (unsandboxedFrames.length > 0) addFinding(context, 'LOW', 'Iframes without sandbox attributes detected', `${unsandboxedFrames.length} iframe(s) lack sandbox.`, 'Use sandbox with the minimum required capabilities for untrusted frames.');
    if (typeof global.onmessage === 'function') {
      addFinding(context, 'MEDIUM', 'A global postMessage handler is present', 'window.onmessage is assigned.', 'Validate event.origin and event.source before processing message data.');
    }
    if (global.opener && global.opener !== global) {
      addFinding(context, 'LOW', 'Window has an opener reference', 'window.opener is present.', 'Use rel=noopener or Cross-Origin-Opener-Policy where appropriate.');
    }
  }

  // A same-origin GET-only frame probe. It does not click, submit, or mutate state.
  async function checkClickjackingProbe(context) {
    logCheck('Running a non-interactive clickjacking frame probe');
    if (global.location.protocol === 'file:') return;
    const frame = global.document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-100px;top:-100px;border:0;opacity:0;';
    const loaded = new Promise((resolve) => {
      const timer = global.setTimeout(() => resolve(false), 1500);
      frame.onload = () => { global.clearTimeout(timer); resolve(true); };
      frame.onerror = () => { global.clearTimeout(timer); resolve(false); };
    });
    frame.src = global.location.href;
    global.document.body.appendChild(frame);
    const didLoad = await loaded;
    frame.remove();
    if (didLoad) addFinding(context, 'MEDIUM', 'Page loaded inside a hidden frame', 'The current page did not visibly reject a same-origin frame probe.', 'Verify X-Frame-Options and CSP frame-ancestors headers. A load result alone is not proof of clickjacking exploitability.');
  }

  const checks = {
    storage: checkBrowserStorage,
    xss: checkDomXssIndicators,
    reflection: checkReflectionVariants,
    csrf: checkCsrfIndicators,
    securityMeta: checkSecurityMetaTags,
    headers: checkSecurityHeaders,
    mixedContent: checkMixedContent,
    credentials: checkCredentialExposure,
    messaging: checkMessagingAndFrames,
    clickjacking: checkClickjackingProbe,
  };

  async function run(options = {}) {
    const context = createContext();
    const selectedChecks = options.checks || Object.keys(checks);
    for (const name of selectedChecks) {
      if (typeof checks[name] !== 'function') continue;
      await checks[name](context);
    }
    return context;
  }

  function printReport(report) {
    console.group(`Client security audit ${VERSION}`);
    console.info('Authorized testing / educational use only. Safe browser probes; verify findings manually.');
    console.info(`Auditing current document: ${global.document.location.href}`);
    console.table(report.findings);
    const summary = report.findings.reduce((counts, finding) => {
      counts[finding.severity] = (counts[finding.severity] || 0) + 1;
      return counts;
    }, { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 });
    console.info(`Summary: ${report.findings.length} finding(s) — HIGH: ${summary.HIGH}, MEDIUM: ${summary.MEDIUM}, LOW: ${summary.LOW}, INFO: ${summary.INFO}`);
    console.info(`Completed ${report.checkedAt} for ${report.page}`);
    console.groupEnd();
    return report;
  }

  const api = { checks, run, printReport, version: VERSION };
  global.clientSecurityAudit = api;
  console.info(`[client-security-audit] v${VERSION} attached to current document: ${global.document.location.href}`);
  void run().then(printReport);
})(window);