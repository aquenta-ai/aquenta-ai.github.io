(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- Nav, theme, reveal ---------- */

  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const toggle = $("#navToggle");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $("#navLinks").addEventListener("click", e => {
    if (e.target.closest("a")) { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
  });

  $("#themeToggle").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("aq-theme", root.dataset.theme); } catch (e) {}
  });

  $("#year").textContent = new Date().getFullYear();

  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { threshold: .15 });
  document.querySelectorAll(".reveal, .step").forEach(el => io.observe(el));

  const counter = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      counter.unobserve(e.target);
      const el = e.target, end = +el.dataset.count, suffix = el.dataset.suffix || "";
      if (reduceMotion) continue;
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min(1, (now - t0) / 1600), v = Math.round(end * (1 - (1 - p) ** 3));
        el.textContent = v.toLocaleString("en-US") + (p === 1 ? suffix : "");
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: .6 });
  document.querySelectorAll("[data-count]").forEach(el => counter.observe(el));

  // Runs `start` while `el` is on screen, `stop` when it leaves.
  function whenVisible(el, start, stop) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: .05 }).observe(el);
  }

  function fitCanvas(c) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /* ---------- Contact form (Web3Forms + hCaptcha) ---------- */

  (function contact() {
    const form = $("#contactForm"), status = $("#formStatus");
    const setStatus = (msg, kind) => { status.textContent = msg; status.className = "form-status " + (kind || ""); };

    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const data = Object.fromEntries(new FormData(form));
      if (data.access_key.startsWith("YOUR_")) {
        setStatus("The contact form isn't configured yet.", "err");
        return;
      }
      if (!data["h-captcha-response"]) {
        setStatus("Please complete the captcha.", "err");
        return;
      }
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      setStatus("Sending…");
      try {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data)
        });
        const out = await res.json();
        if (!res.ok || !out.success) throw new Error(out.message || "Request failed");
        form.reset();
        if (window.hcaptcha) window.hcaptcha.reset();
        setStatus("Thanks. Your message is on its way and we'll be in touch shortly.", "ok");
      } catch (err) {
        setStatus("Something went wrong sending that. Please try again in a moment.", "err");
      } finally {
        btn.disabled = false;
      }
    });
  })();

  /* ---------- Hero: voice waves resolving into signal ---------- */

  (function hero() {
    const c = $("#heroCanvas");
    let raf = 0, t = 0;
    const mouse = { x: .7, y: .4, tx: .7, ty: .4 };
    const waves = Array.from({ length: 7 }, (_, i) => ({
      y: .3 + i * .075,
      amp: 18 + Math.random() * 30,
      f1: .004 + Math.random() * .004,
      f2: .011 + Math.random() * .01,
      sp: .6 + Math.random() * .8,
      hue: i % 2 ? "143,176,255" : "111,240,230",
      ph: Math.random() * 10
    }));
    const pulses = Array.from({ length: 26 }, () => ({ w: Math.floor(Math.random() * waves.length), x: Math.random(), v: .0008 + Math.random() * .0016 }));

    window.addEventListener("pointermove", e => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = e.clientY / window.innerHeight;
    }, { passive: true });

    function waveY(wv, x, w, h) {
      // Amplitude dies off to the right: noisy voice on the left, clean signal on the right.
      const fade = Math.max(0, 1 - x / (w * .92));
      const near = Math.exp(-((x / w - mouse.x) ** 2) / .02) * (1 - Math.abs(wv.y - mouse.y)) * 26;
      return wv.y * h
        + Math.sin(x * wv.f1 + t * wv.sp + wv.ph) * wv.amp * (.35 + fade)
        + Math.sin(x * wv.f2 - t * wv.sp * 1.7) * wv.amp * .6 * fade * fade
        + Math.sin(x * .03 + t * 3) * near * fade;
    }

    function frame() {
      const { ctx, w, h } = fitCanvas(c);
      t += .012;
      mouse.x += (mouse.tx - mouse.x) * .05;
      mouse.y += (mouse.ty - mouse.y) * .05;
      ctx.clearRect(0, 0, w, h);

      for (const wv of waves) {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, `rgba(${wv.hue},0)`);
        g.addColorStop(.35, `rgba(${wv.hue},.35)`);
        g.addColorStop(1, `rgba(${wv.hue},.08)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const y = waveY(wv, x, w, h);
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }

      for (const p of pulses) {
        p.x += p.v;
        if (p.x > 1) { p.x = 0; p.w = Math.floor(Math.random() * waves.length); }
        const x = p.x * w, y = waveY(waves[p.w], x, w, h);
        const r = p.x > .8 ? 2.6 : 1.6;
        ctx.fillStyle = p.x > .8 ? "rgba(255,255,255,.95)" : "rgba(143,176,255,.8)";
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        if (p.x > .8) {
          ctx.strokeStyle = `rgba(111,240,230,${(1 - p.x) * 3})`;
          ctx.beginPath(); ctx.arc(x, y, 6 + (p.x - .8) * 60, 0, Math.PI * 2); ctx.stroke();
        }
      }
      raf = requestAnimationFrame(frame);
    }

    if (reduceMotion) { frame(); cancelAnimationFrame(raf); return; }
    whenVisible(c, () => { if (!raf) raf = requestAnimationFrame(frame); }, () => { cancelAnimationFrame(raf); raf = 0; });
  })();

  /* ---------- Verbasignal demo ---------- */

  (function verbasignal() {
    const tx = $("#vsTx"), evs = $("#vsEvents"), wave = $("#vsWave");
    let running = false, speaking = 0, raf = 0, loop = 0;

    const script = [
      { who: "PILOT", text: "Ground, Northwind four one seven, stand three two, request pushback." },
      { who: "GROUND", text: "Northwind four one seven, pushback approved, face west.",
        ev: { type: "PUSHBACK_APPROVED", spoken: "Northwind 417", icao: "NWD417", stand: "32", conf: "0.94", settle: "ok" } },
      { noise: "[carrier only · 0.4 s · gated before ASR]" },
      { who: "GROUND", text: "Skylark niner two, taxi to holding point bravo three via alpha, runway three four left.",
        ev: { type: "TAXI_CLEARANCE", spoken: "Skylark 92", icao: "SKL92", route: "A", limit: "B3", conf: "0.91", settle: "ok" } },
      { who: "GROUND", text: "…niner… line up and… [unclear]",
        ev: { type: "LINE_UP", spoken: null, icao: null, conf: "0.38", settle: "unres" } }
    ];

    const esc = s => s.replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
    const k = s => `<span class="k">"${s}"</span>`;
    const str = v => v == null ? `<span class="n">null</span>` : `<span class="s">"${esc(v)}"</span>`;

    function eventHtml(e, status) {
      const label = { prov: "PROVISIONAL", ok: "ASSERTED", unres: "UNRESOLVED" }[status];
      const rows = [
        `  ${k("event_type")}: ${str(e.type)},`,
        `  ${k("callsign")}: { ${k("spoken")}: ${str(e.spoken)}, ${k("icao")}: ${str(e.icao)} },`
      ];
      if (e.stand) rows.push(`  ${k("stand")}: ${str(e.stand)},`);
      if (e.limit) rows.push(`  ${k("route")}: ${str(e.route)}, ${k("limit")}: ${str(e.limit)},`);
      rows.push(`  ${k("confidence")}: <span class="n">${e.conf}</span>,`);
      rows.push(`  ${k("status")}: <span class="status ${status}">${label}</span>`);
      return `{\n${rows.join("\n")}\n}`;
    }

    async function run() {
      const my = ++loop;
      while (running && my === loop) {
        tx.innerHTML = ""; evs.innerHTML = "";
        for (const step of script) {
          if (!running || my !== loop) return;
          const line = document.createElement("div");
          const time = new Date().toISOString().slice(11, 19);
          if (step.noise) {
            line.className = "vs-line noise";
            line.textContent = step.noise;
            speaking = .25;
          } else {
            line.className = "vs-line";
            line.innerHTML = `<span class="t">${time}</span><span class="who">${step.who}</span> ${esc(step.text)}`;
            speaking = 1;
          }
          tx.appendChild(line);
          while (tx.children.length > 4) tx.firstElementChild.remove();
          requestAnimationFrame(() => line.classList.add("show"));
          await sleep(1500);
          speaking = 0;

          if (step.ev) {
            const card = document.createElement("div");
            card.className = "vs-event";
            const first = step.ev.settle === "unres" ? "unres" : "prov";
            card.innerHTML = eventHtml(step.ev, first);
            evs.prepend(card);
            while (evs.children.length > 2) evs.lastElementChild.remove();
            requestAnimationFrame(() => card.classList.add("show"));
            if (first === "prov") {
              await sleep(1300);
              card.innerHTML = eventHtml(step.ev, "ok");
            }
          }
          await sleep(900);
        }
        await sleep(2200);
      }
    }

    const bars = Array.from({ length: 90 }, () => 0);
    function drawWave() {
      const { ctx, w, h } = fitCanvas(wave);
      bars.shift();
      bars.push(speaking ? (.25 + Math.random() * .75) * speaking : Math.random() * .06);
      ctx.clearRect(0, 0, w, h);
      const bw = w / bars.length;
      bars.forEach((v, i) => {
        const bh = Math.max(2, v * (h - 16));
        ctx.fillStyle = v > .08 ? `rgba(111,240,230,${.35 + v * .6})` : "rgba(102,114,168,.5)";
        ctx.fillRect(i * bw + 1, (h - bh) / 2, Math.max(1, bw - 2), bh);
      });
      raf = requestAnimationFrame(drawWave);
    }

    whenVisible(tx.closest(".demo"), () => {
      if (running) return;
      running = true;
      run();
      if (!reduceMotion) raf = requestAnimationFrame(drawWave);
    }, () => {
      running = false;
      cancelAnimationFrame(raf);
    });
  })();

  /* ---------- Verbasignal downstream: announcements ---------- */

  (function announcements() {
    const root = $("#vaDownstream");
    if (!root) return;
    const flow = $(".va-flow", root), ev = $("#vaEvent"), written = $("#vaWritten");
    const checks = [...root.querySelectorAll(".va-check")], rail = $("#vaLangs");
    const said = $("#vaSaid"), wave = $("#vaWave"), pa = $("#vaPA");

    // Languages the translator writes. The demo shows a sample of them;
    // `voice` marks the ones with a validated speech voice for the PA today.
    const TOTAL = 23;
    const LANGS = [
      { code: "EN", name: "English", voice: true, text: "Passengers arriving on Northwind flight 417 from Mumbai, your baggage will be on belt 5. Thank you." },
      { code: "HI", name: "हिन्दी", voice: true, text: "मुंबई से आने वाली नॉर्थविंड उड़ान 417 के यात्रियों का सामान बेल्ट 5 पर आएगा। धन्यवाद।" },
      { code: "TA", name: "தமிழ்", text: "மும்பையிலிருந்து வரும் நார்த்விண்ட் விமானம் 417 பயணிகளின் உடைமைகள் பெல்ட் 5 இல் வரும். நன்றி." },
      { code: "BN", name: "বাংলা", text: "মুম্বাই থেকে আগত নর্থউইন্ড ফ্লাইট 417-এর যাত্রীদের লাগেজ বেল্ট 5-এ আসবে। ধন্যবাদ।" },
      { code: "MR", name: "मराठी", text: "मुंबईहून येणाऱ्या नॉर्थविंड विमान 417 च्या प्रवाशांचे सामान बेल्ट 5 वर येईल. धन्यवाद." },
      { code: "TE", name: "తెలుగు", text: "ముంబై నుండి వస్తున్న నార్త్‌విండ్ విమానం 417 ప్రయాణికుల సామాను బెల్ట్ 5 పైకి వస్తుంది. ధన్యవాదాలు." },
      { code: "KN", name: "ಕನ್ನಡ", text: "ಮುಂಬೈನಿಂದ ಬರುವ ನಾರ್ತ್‌ವಿಂಡ್ ವಿಮಾನ 417 ರ ಪ್ರಯಾಣಿಕರ ಸಾಮಾನು ಬೆಲ್ಟ್ 5 ಕ್ಕೆ ಬರುತ್ತದೆ. ಧನ್ಯವಾದಗಳು." },
      { code: "GU", name: "ગુજરાતી", text: "મુંબઈથી આવતી નોર્થવિન્ડ ફ્લાઇટ 417 ના મુસાફરોનો સામાન બેલ્ટ 5 પર આવશે. આભાર." },
      { code: "PA", name: "ਪੰਜਾਬੀ", text: "ਮੁੰਬਈ ਤੋਂ ਆਉਣ ਵਾਲੀ ਨੌਰਥਵਿੰਡ ਉਡਾਣ 417 ਦੇ ਯਾਤਰੀਆਂ ਦਾ ਸਮਾਨ ਬੈਲਟ 5 'ਤੇ ਆਵੇਗਾ। ਧੰਨਵਾਦ।" }
    ];
    $("#vaCount").textContent = String(TOTAL);

    const esc = t => t.replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
    ev.innerHTML = [
      "{",
      `  <span class="k">"event_type"</span>: <span class="s">"ARRIVAL_TAXI_IN"</span>,`,
      `  <span class="k">"callsign"</span>: <span class="s">"NWD417"</span>,`,
      `  <span class="k">"stand"</span>: <span class="s">"32"</span>,`,
      `  <span class="k">"status"</span>: <span class="status ok">ASSERTED</span>`,
      "}"
    ].join("\n");

    rail.innerHTML = LANGS.map((l, i) =>
      `<span class="va-lang" role="listitem" data-i="${i}">${l.code}<i>${esc(l.name)}</i></span>`
    ).join("") + `<span class="va-lang" role="listitem">+${TOTAL - LANGS.length} more</span>`;
    const chips = [...rail.querySelectorAll("[data-i]")];

    const words = (el, text) => {
      el.innerHTML = text.split(" ").map(w => `<span class="w">${esc(w)}</span>`).join(" ");
      return [...el.querySelectorAll(".w")];
    };

    let running = false, loop = 0, raf = 0, level = 0;

    async function read(spans, pace, my) {
      for (const [i, w] of spans.entries()) {
        if (!running || my !== loop) return false;
        spans[i - 1]?.classList.remove("now");
        w.classList.add("on", "now");
        level = 1;
        await sleep(pace);
      }
      spans.at(-1)?.classList.remove("now");
      return true;
    }

    async function run() {
      const my = ++loop;
      while (running && my === loop) {
        checks.forEach(c => c.classList.remove("ok"));
        said.innerHTML = ""; chips.forEach(c => c.classList.remove("on"));
        flow.classList.add("pulse");
        await sleep(700);
        if (!(await read(words(written, LANGS[0].text), 110, my))) return;
        for (const c of checks) { await sleep(380); c.classList.add("ok"); }
        flow.classList.remove("pulse");
        for (const [i, lang] of LANGS.entries()) {
          if (!running || my !== loop) return;
          chips.forEach(c => c.classList.toggle("on", c.dataset.i === String(i)));
          pa.classList.toggle("on", !!lang.voice);
          pa.title = lang.voice ? "Voiced on the PA" : "Text on display boards and app; PA voice for English and Hindi today";
          said.lang = lang.code.toLowerCase();
          const spans = words(said, lang.text);
          voiced = !!lang.voice;
          if (!(await read(spans, lang.voice ? 230 : 120, my))) return;
          level = 0;
          await sleep(900);
        }
        await sleep(1600);
      }
    }

    let voiced = false;
    const bars = Array.from({ length: 64 }, () => 0);
    function draw() {
      const { ctx, w, h } = fitCanvas(wave);
      bars.shift();
      bars.push(voiced && level ? .2 + Math.random() * .8 : Math.random() * .05);
      level *= .9;
      ctx.clearRect(0, 0, w, h);
      const bw = w / bars.length;
      bars.forEach((v, i) => {
        const bh = Math.max(2, v * (h - 6));
        ctx.fillStyle = v > .08 ? `rgba(111,240,230,${.35 + v * .6})` : "rgba(102,114,168,.45)";
        ctx.fillRect(i * bw + 1, (h - bh) / 2, Math.max(1, bw - 2), bh);
      });
      raf = requestAnimationFrame(draw);
    }

    if (reduceMotion) {
      words(written, LANGS[0].text).forEach(w => w.classList.add("on"));
      checks.forEach(c => c.classList.add("ok"));
      chips[1].classList.add("on"); pa.classList.add("on");
      words(said, LANGS[1].text).forEach(w => w.classList.add("on"));
      return;
    }
    whenVisible(root, () => {
      if (running) return;
      running = true;
      run();
      raf = requestAnimationFrame(draw);
    }, () => {
      running = false;
      cancelAnimationFrame(raf);
    });
  })();

  /* ---------- Skyweave demo ---------- */

  (function skyweave() {
    const c = $("#swMap"), chat = $("#swChat");
    let raf = 0, running = false, loop = 0, t = 0;
    const fields = [
      { name: "Field A", x: .2, y: .3 }, { name: "Field B", x: .58, y: .48 },
      { name: "Field C", x: .82, y: .22 }, { name: "Field D", x: .4, y: .78 }
    ];
    const prefixes = ["NWD", "SKL", "AQN", "BLU", "ORX", "TRL", "VEL", "KST"];
    const planes = Array.from({ length: 30 }, () => {
      const a = Math.random() * Math.PI * 2;
      return {
        id: prefixes[Math.floor(Math.random() * prefixes.length)] + (100 + Math.floor(Math.random() * 899)),
        x: Math.random(), y: Math.random(),
        vx: Math.cos(a) * .0006, vy: Math.sin(a) * .0006, trail: [], hit: false
      };
    });
    const cell = { x: .55, y: .44, r: .16 };
    // Route a few flights through the cell so the copilot always has something to find.
    planes.slice(0, 4).forEach((p, i) => {
      p.x = cell.x - .12 + i * .07;
      p.y = cell.y - .06 + (i % 2) * .1;
      p.vx = .00035; p.vy = (i % 2 ? -1 : 1) * .00012;
    });
    let highlight = false;

    function cellPath(ctx, w, h, scale = 1) {
      ctx.beginPath();
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = cell.r * scale * (1 + .18 * Math.sin(a * 3 + t * .6) + .1 * Math.cos(a * 5 - t * .4));
        const x = (cell.x + Math.cos(a) * r * .9) * w, y = (cell.y + Math.sin(a) * r * 1.1) * h;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    }

    function frame() {
      const { ctx, w, h } = fitCanvas(c);
      t += .016;
      cell.x = .55 + Math.sin(t * .05) * .05;
      ctx.fillStyle = "#050c2e";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(60,80,170,.18)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // Region boundaries
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(143,176,255,.28)";
      ctx.beginPath(); ctx.moveTo(w * .46, 0); ctx.lineTo(w * .5, h * .55); ctx.lineTo(w, h * .62); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h * .6); ctx.lineTo(w * .5, h * .55); ctx.stroke();
      ctx.setLineDash([]);

      // Convective cell
      for (const [s, a] of [[1.35, .06], [1.15, .1], [1, .2]]) {
        cellPath(ctx, w, h, s);
        ctx.fillStyle = `rgba(245,165,36,${a})`;
        ctx.fill();
      }
      cellPath(ctx, w, h);
      ctx.strokeStyle = "rgba(245,165,36,.75)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      for (const f of fields) {
        const x = f.x * w, y = f.y * h;
        ctx.strokeStyle = "rgba(95,240,176,.8)";
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(95,240,176,.9)";
        ctx.font = "10px JetBrains Mono, monospace";
        ctx.fillText(f.name.toUpperCase(), x + 9, y + 3);
      }

      cellPath(ctx, w, h);
      for (const p of planes) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -.05) p.x = 1.05; if (p.x > 1.05) p.x = -.05;
        if (p.y < -.05) p.y = 1.05; if (p.y > 1.05) p.y = -.05;
        p.trail.push([p.x, p.y]);
        if (p.trail.length > 26) p.trail.shift();
        // isPointInPath takes raw canvas pixels, not transformed coords.
        p.hit = ctx.isPointInPath(p.x * c.width, p.y * c.height);
      }

      for (const p of planes) {
        const col = p.hit ? "255,123,137" : "143,176,255";
        ctx.strokeStyle = `rgba(${col},.25)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        p.trail.forEach(([x, y], i) => {
          if (i && Math.abs(x - p.trail[i - 1][0]) > .5) ctx.moveTo(x * w, y * h);
          else i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h);
        });
        ctx.stroke();
        const x = p.x * w, y = p.y * h;
        ctx.fillStyle = `rgb(${col})`;
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgb(${col})`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + p.vx * 14000, y + p.vy * 14000); ctx.stroke();
        if (p.hit && highlight) {
          ctx.strokeStyle = "rgba(255,123,137,.8)";
          ctx.beginPath(); ctx.arc(x, y, 9 + Math.sin(t * 5) * 2, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "#ffb3bc";
          ctx.font = "10px JetBrains Mono, monospace";
          ctx.fillText(p.id, x + 12, y - 8);
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function say(cls, html) {
      const m = document.createElement("div");
      m.className = "sw-msg " + cls;
      m.innerHTML = html;
      chat.appendChild(m);
      while (chat.children.length > 3) chat.firstElementChild.remove();
      requestAnimationFrame(() => m.classList.add("show"));
    }

    async function run() {
      const my = ++loop;
      while (running && my === loop) {
        chat.innerHTML = ""; highlight = false;
        await sleep(1400);
        if (!running || my !== loop) return;
        say("user", "Which flights are inside the convective cell?");
        await sleep(1600);
        const inside = planes.filter(p => p.hit).map(p => p.id);
        highlight = true;
        say("ai", inside.length
          ? `<b>${inside.length} flight${inside.length > 1 ? "s" : ""}</b> inside the cell near Field B: ${inside.slice(0, 4).join(", ")}${inside.length > 4 ? "…" : ""}. Highlighted on the map.`
          : "No flights inside the cell right now. Two are converging on it from the west; I'll alert if they enter.");
        await sleep(4200);
        if (!running || my !== loop) return;
        say("user", "Delay risk at Field B?");
        await sleep(1600);
        say("ai", "<b>High</b>, about 35 min. Convective cell over the field and demand above capacity. Suggest metering arrivals from the north. <span style='opacity:.6'>Source: weather, traffic</span>");
        await sleep(6000);
      }
    }

    whenVisible(c, () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
      run();
    }, () => {
      running = false;
      cancelAnimationFrame(raf);
    });
  })();

  /* ---------- Interpres demo ---------- */

  (function interpres() {
    const src = $("#ipSrc"), tgt = $("#ipTgt"), lang = $("#ipLang");
    const srcState = $("#ipSrcState"), tgtState = $("#ipTgtState");
    const bar = $("#ipBar"), ms = $("#ipMs");
    let running = false, loop = 0;

    const lines = [
      { lang: "Portuguese", src: "Eu vi o carro às nove e meia, não às dez.",
        draft: "I saw the car at nine thirty, no at ten…",
        final: "I saw the car at <span class='hl'>half past nine</span>, <span class='hl'>not</span> at ten.", lat: 2.6 },
      { lang: "Hindi", src: "मैंने उस दिन कोई पैसा नहीं लिया था।",
        draft: "I that day any money…",
        final: "I <span class='hl'>did not</span> take any money that day.", lat: 2.9 },
      { lang: "Spanish", src: "El contrato se firmó el 3 de marzo en presencia del señor Ruiz.",
        draft: "The contract was signed the 3 of March in…",
        final: "The contract was signed on <span class='hl'>3 March</span> in the presence of <span class='hl'>Mr Ruiz</span>.", lat: 3.1 }
    ];

    async function run() {
      const my = ++loop;
      const alive = () => running && my === loop;
      while (alive()) {
        for (const l of lines) {
          if (!alive()) return;
          lang.textContent = "Source: " + l.lang;
          src.textContent = ""; tgt.innerHTML = "";
          srcState.textContent = "listening"; tgtState.textContent = "waiting";
          bar.style.width = "0"; ms.textContent = "0.0 s";

          const words = l.src.split(" ");
          for (let i = 0; i < words.length; i++) {
            if (!alive()) return;
            src.textContent = words.slice(0, i + 1).join(" ");
            if (i === Math.floor(words.length / 2)) {
              tgt.innerHTML = `<span class="prov">${l.draft}</span>`;
              tgtState.textContent = "provisional";
            }
            await sleep(260);
          }
          srcState.textContent = "final";

          // Pause detected: show the clock running until final text lands.
          const steps = 12;
          for (let s = 1; s <= steps; s++) {
            if (!alive()) return;
            const v = (l.lat * s) / steps;
            bar.style.width = (v / 4) * 100 + "%";
            ms.textContent = v.toFixed(1) + " s";
            await sleep(70);
          }
          tgt.innerHTML = l.final;
          tgtState.textContent = "final · verified terms";
          await sleep(3600);
        }
      }
    }

    whenVisible(src.closest(".demo"), () => {
      if (running) return;
      running = true;
      run();
    }, () => { running = false; });
  })();
})();
