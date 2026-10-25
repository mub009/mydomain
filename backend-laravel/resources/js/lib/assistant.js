import { api, errorMessage } from "./api";
import { icon } from "./icons";
import { $, $$, esc } from "./ui";
import { reloadWithFlash } from "./widgets";

// The website assistant panel (pages/dashboard/partials/assistant.blade.php).
// What the owner types or says goes to POST /businesses/:id/assistant, which
// answers with a reply and a list of proposed changes; nothing changes until
// the owner presses Apply (POST …/assistant/apply). Speech uses the browser's
// own recognition (Chrome, Edge, Android) — where it's missing the mic hides.
const LANG_KEY = "mk-assistant-lang";

export function initAssistant(businessId) {
  const panel = $("[data-assistant]");
  if (!panel) return;
  const base = `/businesses/${businessId}/assistant`;
  const log = $("[data-assistant-log]", panel);
  const form = $("[data-assistant-form]", panel);
  const input = form.elements.namedItem("message");
  const send = $("[data-assistant-send]", form);
  const history = []; // earlier turns, for follow-ups like "make it 10 instead"
  let busy = false;

  const openButton = $("[data-assistant-open]");
  const setOpen = (open) => {
    panel.hidden = !open;
    openButton.hidden = open;
    if (open) input.focus();
  };
  openButton.addEventListener("click", () => setOpen(true));
  $("[data-assistant-close]", panel).addEventListener("click", () => setOpen(false));

  const scroll = () => (log.scrollTop = log.scrollHeight);
  const bubble = (html, mine = false) => {
    const el = document.createElement("div");
    el.className = mine
      ? "ml-auto max-w-[85%] w-fit rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-white"
      : "max-w-[92%] rounded-2xl rounded-tl-sm bg-gray-100 px-3 py-2 text-ink-800";
    el.innerHTML = html;
    log.append(el);
    scroll();
    return el;
  };

  async function ask(message) {
    message = message.trim();
    if (!message || busy) return;
    busy = true;
    send.disabled = true;
    $("[data-assistant-examples]", log)?.remove();
    bubble(esc(message), true);
    input.value = "";
    const thinking = bubble(`<span class="text-ink-400">Thinking…</span>`);
    try {
      const { data: plan } = await api.post(base, { message, history: history.slice(-8) });
      history.push({ role: "user", text: message }, { role: "assistant", text: plan.reply });
      thinking.innerHTML = esc(plan.reply);
      if (plan.actions.length) proposal(thinking, plan.actions);
      if (plan.notes.length) thinking.insertAdjacentHTML("beforeend", plan.notes.map((n) => `<p class="mt-1.5 text-xs text-ink-500">${esc(n)}</p>`).join(""));
    } catch (err) {
      thinking.innerHTML = `<span class="text-red-600">${esc(errorMessage(err))}</span>`;
    } finally {
      busy = false;
      send.disabled = false;
      scroll();
    }
  }

  // The proposed changes, with Apply / Not now.
  function proposal(el, actions) {
    const box = document.createElement("div");
    box.className = "mt-2 rounded-xl border border-gray-200 bg-white p-2.5";
    box.innerHTML = `<p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Changes</p>
      <ul class="space-y-1 text-[13px] text-ink-800">${actions.map((a) => `<li class="flex gap-1.5">${icon("check", { size: 14, className: "mt-0.5 shrink-0 text-brand-600" })}<span>${esc(a.summary)}</span></li>`).join("")}</ul>
      <div class="mt-2.5 flex gap-2">
        <button type="button" data-apply class="btn-primary px-3 py-1.5 text-xs">Apply changes</button>
        <button type="button" data-skip class="btn-secondary px-3 py-1.5 text-xs">Not now</button>
      </div>`;
    el.append(box);
    const buttons = $$("button", box);
    $("[data-skip]", box).addEventListener("click", () => {
      buttons.forEach((b) => b.remove());
      box.insertAdjacentHTML("beforeend", `<p class="mt-1 text-xs text-ink-500">Left as it is.</p>`);
    });
    $("[data-apply]", box).addEventListener("click", async (e) => {
      buttons.forEach((b) => (b.disabled = true));
      e.currentTarget.textContent = "Applying…";
      try {
        // Send back what was shown; the server checks it again before saving.
        await api.post(`${base}/apply`, { actions: actions.map(({ summary, ...action }) => action) });
        reloadWithFlash(`Done — ${actions.length === 1 ? "1 change is" : `${actions.length} changes are`} saved and live on your website.`);
      } catch (err) {
        buttons.forEach((b) => (b.disabled = false));
        $("[data-apply]", box).textContent = "Apply changes";
        box.insertAdjacentHTML("beforeend", `<p class="mt-1.5 text-xs text-red-600">${esc(errorMessage(err))}</p>`);
      }
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    ask(input.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input.value);
    }
  });
  log.addEventListener("click", (e) => {
    const example = e.target.closest("[data-assistant-examples] button");
    if (example) ask(example.textContent);
  });

  initVoice(panel, input, ask);
}

function initVoice(panel, input, ask) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return; // e.g. Firefox: typing only
  const mic = $("[data-assistant-mic]", panel);
  const lang = $("[data-assistant-lang]", panel);
  const status = $("[data-assistant-listening]", panel);
  mic.hidden = false;
  $("[data-assistant-voice-row]", panel).hidden = false;
  try {
    lang.value = localStorage.getItem(LANG_KEY) || navigator.language || "en-IN";
    if (!lang.value) lang.value = "en-IN";
  } catch {
    lang.value = "en-IN";
  }
  lang.addEventListener("change", () => {
    try {
      localStorage.setItem(LANG_KEY, lang.value);
    } catch {
      // ignore
    }
  });

  let recognition = null;
  const stop = () => {
    recognition?.stop();
    recognition = null;
    mic.classList.remove("bg-red-50", "text-red-600", "border-red-200", "animate-pulse");
    status.textContent = "Tap the mic to speak";
  };
  mic.addEventListener("click", () => {
    if (recognition) return stop();
    recognition = new Recognition();
    recognition.lang = lang.value;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalText = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += text;
        else interim += text;
      }
      input.value = (finalText + interim).trim();
    };
    recognition.onerror = (event) => {
      status.textContent = event.error === "not-allowed" ? "Allow the microphone to speak" : "Didn't catch that — try again";
    };
    recognition.onend = () => {
      const said = finalText.trim();
      const err = status.textContent;
      stop();
      if (said) ask(said);
      else if (err.startsWith("Allow") || err.startsWith("Didn't")) status.textContent = err;
    };
    mic.classList.add("bg-red-50", "text-red-600", "border-red-200", "animate-pulse");
    status.textContent = "Listening… tap the mic to stop";
    recognition.start();
  });
}
