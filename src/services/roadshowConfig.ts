import { shouldUseRemoteRoadshowApi } from './deploymentMode';

export interface RoadshowRuntimeConfig {
  amapKey: string;
  amapSecurityCode: string;
}

let cachedConfig: Promise<RoadshowRuntimeConfig> | null = null;

function getBuildTimeConfig(): RoadshowRuntimeConfig {
  return {
    amapKey: import.meta.env.VITE_AMAP_KEY ?? '',
    amapSecurityCode: import.meta.env.VITE_AMAP_SECURITY_CODE ?? '',
  };
}

export async function loadRoadshowConfig(): Promise<RoadshowRuntimeConfig> {
  if (!shouldUseRemoteRoadshowApi()) {
    return {
      amapKey: '',
      amapSecurityCode: '',
    };
  }

  cachedConfig ??= fetch('/api/demo-config', {
    headers: { Accept: 'application/json' },
  })
    .then(async (response) => {
      if (!response.ok) {
        return getBuildTimeConfig();
      }
      const data = (await response.json()) as Partial<RoadshowRuntimeConfig>;
      return {
        amapKey: data.amapKey || getBuildTimeConfig().amapKey,
        amapSecurityCode: data.amapSecurityCode || getBuildTimeConfig().amapSecurityCode,
      };
    })
    .catch(() => getBuildTimeConfig());

  return cachedConfig;
}
