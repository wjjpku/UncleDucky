export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export const $ = (selector) => document.querySelector(selector);

export const $$ = (selector) => Array.from(document.querySelectorAll(selector));
