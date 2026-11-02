import { useEffect, useRef } from 'react';
import { pandaVideo, pandaProgress, reachedCompletion } from './lib/pandaProgress';

export function usePandaCompletion(url: string | undefined, lessonId: string | undefined, complete: (id: string) => Promise<boolean>) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completeRef = useRef(complete);
  useEffect(() => { completeRef.current = complete; }, [complete]);
  useEffect(() => {
    const video = pandaVideo(url);
    if (!video || !lessonId) return;
    let progress = {};
    let pending = false;
    let done = false;
    let disposed = false;
    let retryAfter = 0;
    const receive = async (event: MessageEvent) => {
      progress = pandaProgress(event, iframeRef.current?.contentWindow, video, progress);
      if (disposed || done || pending || Date.now() < retryAfter || !reachedCompletion(progress)) return;
      pending = true;
      try { done = await completeRef.current(lessonId); }
      finally { pending = false; retryAfter = Date.now() + 15000; }
    };
    window.addEventListener('message', receive);
    return () => { disposed = true; window.removeEventListener('message', receive); };
  }, [url, lessonId]);
  return iframeRef;
}
