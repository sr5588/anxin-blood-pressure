"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WheelFeedback = void 0;
const local_1 = require("./local");
// A quiet original detent sound, not a recording of Apple's system sounds.
class WheelFeedback {
    constructor() {
        this.audio = null;
        this.lastSound = 0;
        this.lastHaptic = 0;
    }
    init() {
        if (this.audio)
            return;
        try {
            this.audio = wx.createInnerAudioContext();
            this.audio.src = '/assets/wheel-tick.wav';
            this.audio.volume = 0.22;
            this.audio.obeyMuteSwitch = true;
            this.audio.onError(() => { });
        }
        catch { }
    }
    tick() {
        const now = Date.now();
        if (now - this.lastSound < 100 || local_1.storage.get('wheelSound', true) === false)
            return;
        this.lastSound = now;
        this.init();
        try {
            this.audio?.stop();
            this.audio?.play();
        }
        catch { }
    }
    settle() {
        const now = Date.now();
        this.tick();
        if (now - this.lastHaptic < 180)
            return;
        this.lastHaptic = now;
        wx.vibrateShort({ type: 'light', fail: () => { } });
    }
    destroy() {
        this.audio?.destroy();
        this.audio = null;
    }
}
exports.WheelFeedback = WheelFeedback;
