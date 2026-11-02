import test from 'node:test';
import assert from 'node:assert/strict';
import { pandaVideo, pandaProgress, reachedCompletion } from '../src/lib/pandaProgress.js';
const url = 'https://player-vz-3ca939d8-dc9.tv.pandavideo.com.br/embed/?v=video-id';
const video = pandaVideo(url), source = {};
const event = (data, overrides = {}) => ({ origin: video.origin, source, data: { video: video.video, ...data }, ...overrides });
const state = { duration: 100, currentTime: 74.9, playing: true };
test('only trusted frame, origin and video can update progress', () => {
 for (const override of [{source:{}}, {origin:'https://example.com'}, {data:{video:'other',message:'panda_timeupdate',currentTime:90}}]) {
  assert.equal(pandaProgress(event({message:'panda_timeupdate',currentTime:90},override),source,video,state),state);
 }
 assert.equal(pandaVideo('https://pandavideo.com.br.attacker.com/embed/?v=x'),null);
});
test('75% boundary, valid duration and actual playing state', () => {
 assert.equal(reachedCompletion(state),false);
 assert.equal(reachedCompletion({...state,currentTime:75}),true);
 for(const change of [{duration:0},{duration:NaN},{duration:Infinity},{currentTime:NaN},{playing:false}]) assert.equal(reachedCompletion({...state,currentTime:90,...change}),false);
});
test('ready duration and time events, pause and muted preview', () => {
 const ready = pandaProgress(event({message:'panda_allData',playerData:{duration:200,currentTime:10,paused:false}}),source,video);
 assert.equal(reachedCompletion(pandaProgress(event({message:'panda_timeupdate',currentTime:150}),source,video,ready)),true);
 assert.equal(reachedCompletion(pandaProgress(event({message:'panda_pause'}),source,video,{...ready,currentTime:160})),false);
 assert.equal(pandaProgress(event({message:'panda_timeupdate',currentTime:190,isMutedIndicator:true}),source,video,ready),ready);
 assert.equal(pandaProgress(event({message:'panda_progress',currentTime:200}),source,video,ready),ready);
});
