export function isLocalHostname(hostname) {
  const value = String(hostname || '').toLowerCase();

  return value === 'localhost'
    || value.endsWith('.localhost')
    || value === '127.0.0.1'
    || value === '::1'
    || value === '[::1]';
}

export function canRegisterServiceWorker({ protocol, hostname, serviceWorker } = {}) {
  if (!serviceWorker) {
    return false;
  }

  if (protocol === 'https:') {
    return true;
  }

  return protocol === 'http:' && isLocalHostname(hostname);
}

export async function registerAppServiceWorker(environment = getBrowserEnvironment()) {
  const { location, serviceWorker } = environment;

  if (!location || !canRegisterServiceWorker({
    protocol: location.protocol,
    hostname: location.hostname,
    serviceWorker
  })) {
    return null;
  }

  try {
    return await serviceWorker.register(new URL('../sw.js', import.meta.url).href, {
      scope: new URL('../', import.meta.url).pathname
    });
  } catch {
    return null;
  }
}

function getBrowserEnvironment() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {};
  }

  return {
    location: window.location,
    serviceWorker: navigator.serviceWorker
  };
}
