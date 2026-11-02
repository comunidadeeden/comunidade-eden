export function pandaVideo(url) {
  try {
    const parsed = new URL(url);
    const video = parsed.searchParams.get('v');
    if (parsed.protocol !== 'https:' || !/^player-[a-z0-9-]+\.tv\.pandavideo\.com\.br$/.test(parsed.hostname) || !video) return null;
    return { origin: parsed.origin, video };
  } catch { return null; }
}

// Panda's timeupdate reports playback position, not percentage downloaded.
export function pandaProgress(event, frameWindow, video, previous = {}) {
  if (!video || !frameWindow || event.source !== frameWindow || event.origin !== video.origin) return previous;
  const data = event.data;
  if (!data || data.video !== video.video || data.isMutedIndicator) return previous;
  if (data.message === 'panda_allData') {
    const p = data.playerData;
    if (!p || !Number.isFinite(p.duration) || p.duration <= 0 || !Number.isFinite(p.currentTime)) return previous;
    return { duration: p.duration, currentTime: p.currentTime, playing: p.paused === false };
  }
  if (data.message === 'panda_play') return { ...previous, playing: true };
  if (data.message === 'panda_pause') return { ...previous, playing: false };
  if (data.message === 'panda_timeupdate' && Number.isFinite(data.currentTime)) return { ...previous, currentTime: data.currentTime };
  return previous;
}

export function reachedCompletion(progress) {
  return progress.playing === true && Number.isFinite(progress.duration) && progress.duration > 0 &&
    Number.isFinite(progress.currentTime) && progress.currentTime >= progress.duration * 0.75;
}
