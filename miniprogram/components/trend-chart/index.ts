Component({
  properties: {
    theme: {
      type: String,
      value: 'light',
      observer() {
        this.draw();
      },
    },
    points: {
      type: Array,
      value: [],
      observer() {
        this.draw();
      },
    },
  },
  data: {},
  lifetimes: {
    ready() {
      this.draw();
    },
  },
  methods: {
    draw() {
      const points = this.properties.points as {
        label: string;
        systolic: number;
        diastolic: number;
      }[];
      this.createSelectorQuery()
        .select('#chart')
        .fields({ node: true, size: true })
        .exec((res: any[]) => {
          if (!res[0]?.node) return;
          const canvas = res[0].node,
            ctx = canvas.getContext('2d'),
            w = res[0].width,
            h = res[0].height,
            dpr = wx.getWindowInfo().pixelRatio;
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, w, h);
          if (!points.length) return;
          const min = Math.floor((Math.min(...points.map((p) => p.diastolic)) - 15) / 10) * 10,
            max = Math.ceil((Math.max(...points.map((p) => p.systolic)) + 15) / 10) * 10;
          const x = (i: number) =>
              48 + (w - 68) * (points.length === 1 ? 0.5 : i / (points.length - 1)),
            y = (v: number) => 20 + ((h - 64) * (max - v)) / (max - min);
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'right';
          for (let i = 0; i < 4; i++) {
            const v = Math.round(min + ((max - min) * i) / 3),
              yy = y(v);
            ctx.fillStyle = this.properties.theme === 'dark' ? '#abbfd7' : '#8190a3';
            ctx.fillText(String(v), 35, yy + 4);
            ctx.strokeStyle = this.properties.theme === 'dark' ? '#304258' : '#edf1f6';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(46, yy);
            ctx.lineTo(w - 12, yy);
            ctx.stroke();
          }
          for (const [key, color] of [
            ['systolic', '#df826d'],
            ['diastolic', '#4388df'],
          ] as const) {
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            points.forEach((p, i) => {
              i ? ctx.lineTo(x(i), y(p[key])) : ctx.moveTo(x(i), y(p[key]));
            });
            ctx.stroke();
            points.forEach((p, i) => {
              ctx.beginPath();
              ctx.arc(x(i), y(p[key]), 3.5, 0, Math.PI * 2);
              ctx.fill();
            });
          }
          ctx.fillStyle = '#7c8b9e';
          ctx.textAlign = 'center';
          points.forEach((p, i) => {
            if (
              i === 0 ||
              i === points.length - 1 ||
              i % Math.max(1, Math.ceil(points.length / 4)) === 0
            )
              ctx.fillText(p.label, x(i), h - 10);
          });
        });
    },
  },
});
