import { loadRoadshowConfig } from './roadshowConfig';

type AMapConstructor<T> = new (...args: unknown[]) => T;

export interface AMapNamespace {
  Map: AMapConstructor<unknown>;
  LngLat: AMapConstructor<unknown>;
  Polyline: AMapConstructor<unknown>;
  Marker: AMapConstructor<unknown>;
  Pixel: AMapConstructor<unknown>;
}

declare global {
  interface Window {
    AMap?: AMapNamespace;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
    __hlaAmapPromise?: Promise<AMapNamespace>;
    __hlaAmapLoaded?: () => void;
  }
}

export async function loadAmap(): Promise<AMapNamespace | null> {
  const config = await loadRoadshowConfig();
  if (!config.amapKey) {
    return null;
  }

  if (window.AMap) {
    return window.AMap;
  }

  if (config.amapSecurityCode) {
    window._AMapSecurityConfig = {
      securityJsCode: config.amapSecurityCode,
    };
  }

  window.__hlaAmapPromise ??= new Promise<AMapNamespace>((resolve, reject) => {
    window.__hlaAmapLoaded = () => {
      if (window.AMap) {
        resolve(window.AMap);
      } else {
        reject(new Error('AMap script loaded without global AMap'));
      }
    };

    const script = document.createElement('script');
    const key = encodeURIComponent(config.amapKey);
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&callback=__hlaAmapLoaded`;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load AMap script'));
    document.head.appendChild(script);
  });

  return window.__hlaAmapPromise;
}
