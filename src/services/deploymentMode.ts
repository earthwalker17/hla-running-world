export function shouldUseRemoteRoadshowApi(): boolean {
  if (import.meta.env.VITE_ENABLE_REMOTE_ROADSHOW_API === 'true') {
    return true;
  }

  if (import.meta.env.VITE_DISABLE_REMOTE_ROADSHOW_API === 'true') {
    return false;
  }

  return !import.meta.env.PROD;
}
