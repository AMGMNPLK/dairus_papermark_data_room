"use strict";
// All WAAPI effects use the absolute composition clock, not clip-local time.
// HyperFrames' native WAAPI discovery can set the same global milliseconds
// without changing the intended frame; no GSAP/CDN or wall-clock timers exist.
(() => {
  const duration = 7.2;
  const beatDuration = 2.4;
  const entrance = 0.24;
  const exit = 0.2;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const beats = ["dairus", "updates", "review"].map((name, index) => ({
    elements: [document.getElementById(`label-${name}`), document.getElementById(`beat-${name}`)],
    start: index * beatDuration, animations: [],
  }));
  let currentTime = 0;
  let playbackRate = 1;
  let isPaused = true;
  const clamp = time => Math.min(duration, Math.max(0, Number(time) || 0));
  const frame = (opacity, y, offset, easing) => ({ opacity, transform: `translateY(${y}px)`, offset, ...(easing ? { easing } : {}) });
  function rebuild() {
    for (const beat of beats) {
      for (const animation of beat.animations) animation.cancel();
      beat.animations = [];
      if (reducedMotion.matches) continue;
      for (const element of beat.elements) {
        const end = beat.start + beatDuration;
        const animation = element.animate([
          frame(0, 8, 0),
          frame(0, 8, beat.start / duration, "cubic-bezier(0.22,1,0.36,1)"),
          frame(1, 0, (beat.start + entrance) / duration),
          frame(1, 0, (end - exit) / duration, "ease-in"),
          frame(0, -4, end / duration),
          frame(0, -4, 1),
        ], { duration: duration * 1000, fill: "both", iterations: 1 });
        animation.pause();
        animation.currentTime = currentTime * 1000;
        beat.animations.push(animation);
      }
    }
    render(currentTime);
  }
  function render(time) {
    currentTime = clamp(time);
    for (const beat of beats) {
      const active = currentTime >= beat.start && currentTime < beat.start + beatDuration;
      for (const element of beat.elements) {
        element.style.visibility = active ? "visible" : "hidden";
        element.setAttribute("aria-hidden", active ? "false" : "true");
        if (reducedMotion.matches) {
          element.style.opacity = active ? "1" : "0";
          element.style.transform = "none";
        } else {
          element.style.removeProperty("opacity");
          element.style.removeProperty("transform");
        }
      }
      for (const animation of beat.animations) {
        animation.currentTime = currentTime * 1000;
        animation.pause();
      }
    }
  }
  const timeline = {
    duration: () => duration,
    totalDuration: () => duration,
    time: value => value === undefined ? currentTime : (render(value), timeline),
    totalTime: value => value === undefined ? currentTime : (render(value), timeline),
    seek: value => (render(value), timeline),
    pause: () => (isPaused = true, timeline),
    play: () => (isPaused = false, timeline),
    paused: value => value === undefined ? isPaused : (isPaused = Boolean(value), timeline),
    timeScale: value => value === undefined ? playbackRate : (playbackRate = Number(value) || 1, timeline),
    getChildren: () => [],
    eventCallback: () => timeline,
    repeat: () => 0,
    progress: value => value === undefined ? currentTime / duration : (render(clamp(value * duration)), timeline),
    invalidate: () => timeline,
    vars: { paused: true, repeat: 0 },
  };
  window.__timelines = window.__timelines || {};
  window.__timelines["motion-validation"] = timeline;
  reducedMotion.addEventListener("change", rebuild);
  rebuild();
  window.__motionValidation = { duration, fps: 30, finite: true, reducedMotionLive: true, absoluteWaapiClock: true, timeline };
})();
