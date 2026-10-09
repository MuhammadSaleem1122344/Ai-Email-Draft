import { useState, useEffect, useMemo, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Sparkles, Moon, Sun, HelpCircle, User, Copy, Send, Pencil, RotateCw, Trash2,
  Calendar, Briefcase, Heart, Check, X, History, Download, Undo2, Save,
} from "lucide-react";

// ====== YAHAN APNA WEBHOOK URL PASTE KAREIN (ya .env mein VITE_WEBHOOK_URL) ======
const WEBHOOK_URL =
  import.meta.env.VITE_WEBHOOK_URL ||
  "http://localhost:5678/webhook-test/557156c8-8eb3-4c1d-86c4-56c571f08453";
// Optional: POST {idea, mode, to, subject, tone, length, language, signature} -> JSON {subject, body}
const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT || "";

const TEMPLATES = {
  blank: { label: "Blank", subject: "", body: "" },
  leave: { label: "Leave Request", subject: "Leave request", body: "Dear Sir/Madam,\n\nI would like to request leave from [start date] to [end date] due to [reason]. I will make sure my work is handed over before I leave.\n\nThank you for your consideration.\n\nRegards,\n[Your name]" },
  followup: { label: "Follow-up", subject: "Following up", body: "Hi [Name],\n\nI wanted to follow up on my previous email about [topic]. Could you please let me know the status when you get a chance?\n\nThanks,\n[Your name]" },
  thanks: { label: "Thank You", subject: "Thank you", body: "Hi [Name],\n\nThank you for [what they did]. I really appreciate your help.\n\nBest regards,\n[Your name]" },
  meeting: { label: "Meeting Request", subject: "Meeting request: [topic]", body: "Hi [Name],\n\nI would like to schedule a meeting to discuss [topic]. Would [day/time] or [alternative] work for you? The meeting should take about [duration].\n\nPlease let me know what suits you best.\n\nBest regards,\n[Your name]" },
  job: { label: "Job Application", subject: "Application for [job title]", body: "Dear Hiring Manager,\n\nI am writing to apply for the [job title] position. With [experience/skills], I believe I can contribute to your team. My resume is attached for your review.\n\nI would welcome the chance to discuss my application.\n\nSincerely,\n[Your name]" },
  update: { label: "Project Update", subject: "Project update: [project name]", body: "Hi [Name],\n\nHere is the latest update on [project name]:\n\n- Completed: [items]\n- In progress: [items]\n- Next steps: [items]\n\nPlease let me know if you have questions.\n\nRegards,\n[Your name]" },
  complaint: { label: "Complaint", subject: "Issue with [order/service]", body: "Dear [Name],\n\nI am writing about [issue] related to [order/service number]. [Describe what happened.] I would appreciate it if you could [resolution] by [date].\n\nThank you for your attention.\n\nRegards,\n[Your name]" },
  proposal: { label: "Business Proposal", subject: "Proposal: [offer]", body: "Dear [Name],\n\nI would like to propose [offer] for [company]. It would help you [benefit], with delivery in [timeline] at [price].\n\nI would be glad to walk you through the details at a time that suits you.\n\nBest regards,\n[Your name]" },
  client: { label: "Client Follow-up", subject: "Following up on [topic]", body: "Hi [Name],\n\nI hope you are well. I am following up on [topic] we discussed on [date]. Do you have any questions, or is there anything I can provide to help you decide?\n\nLooking forward to your reply.\n\nBest regards,\n[Your name]" },
};

const QUICK = [
  ["blank", "Write a professional email", Mail], ["meeting", "Request a meeting", Calendar],
  ["client", "Follow up with a client", User], ["job", "Apply for a job", Briefcase],
  ["leave", "Request leave", Calendar], ["thanks", "Thank someone", Heart],
];

const LANG = {
  "English": { hi: n => `Dear ${n},`, bye: "Best regards," },
  "Roman Urdu": { hi: n => `Janab ${n},`, bye: "Shukriya,\nKhair andesh," },
  "Urdu": { hi: n => `${n} صاحب،`, bye: "شکریہ،\nخیر اندیش" },
};

/* ---------- helpers ---------- */
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const recipientsOk = v => v.split(",").map(s => s.trim()).filter(Boolean).every(emailOk) && v.trim() !== "";
const cap = s => s.replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());

function useLocal(key, init) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } }, [key, v]);
  return [v, setV];
}

function localAI(mode, p) {
  const lang = LANG[p.language] || LANG.English, idea = p.idea.trim();
  const first = p.to.split(",")[0].split("@")[0];
  const name = first.replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Sir/Madam";
  const sentences = cap(idea.replace(/\s+/g, " ")).split(/(?<=[.!?])\s+/).filter(Boolean);
  const subj = (p.subject || cap(idea.split(/[.!?\n]/)[0]).slice(0, 60).replace(/[,;:\s]+$/, "")).trim() || "Quick note";
  if (mode === "subject") return { subject: subj };
  if (mode === "shorten") return { body: sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(" ") };
  if (mode === "expand") return { body: idea + "\n\nPlease let me know if you need any additional details or would like to discuss this further. I am happy to adjust based on your feedback." };
  if (mode === "improve") return { body: cap(idea.replace(/[ \t]+/g, " ").replace(/\s+([,.!?])/g, "$1")) };
  const opener = { Friendly: "I hope you're doing well.", Formal: "I trust this message finds you well.", Persuasive: "I'm writing because I believe this is worth your attention.", Apologetic: "I sincerely apologize for any inconvenience.", Concise: "", Professional: "I hope you are well." }[p.tone] || "";
  const detail = p.length === "Short" ? sentences.slice(0, 2) : sentences;
  const extra = p.length === "Detailed" ? ["I would be glad to share more details or arrange a call at your convenience."] : [];
  const paras = [opener, detail.join(" "), ...extra, p.tone === "Concise" ? "Thank you." : "Thank you for your time and consideration."].filter(Boolean);
  return { subject: subj, body: `${lang.hi(name)}\n\n${paras.join("\n\n")}\n\n${lang.bye}\n${p.signature || "[Your name]"}` };
}

async function runAI(mode, p) {
  if (!AI_ENDPOINT) { await new Promise(r => setTimeout(r, 900)); return localAI(mode, p); }
  const res = await fetch(AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, mode }) });
  if (!res.ok) throw new Error("AI " + res.status);
  return res.json();
}

/* ---------- component ---------- */
export default function App() {
  const [f, setF] = useState({ to: "", subject: "", body: "" });
  const [tpl, setTpl] = useState("");
  const [opt, setOpt] = useState({ tone: "Professional", length: "Medium", language: "English" });
  const [signature, setSignature] = useLocal("mc_signature", "");
  const [history, setHistory] = useLocal("mc_history", []);
  const [theme, setTheme] = useLocal("mc_theme", "");
  const [busy, setBusy] = useState("");
  const [aiMade, setAiMade] = useState(false);
  const [lastIdea, setLastIdea] = useState("");
  const [undo, setUndo] = useState(null);
  const [hint, setHint] = useState("");
  const bodyRef = useRef(null);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  useEffect(() => {
    const b = bodyRef.current; if (!b) return;
    b.style.height = "auto";
    b.style.height = Math.min(Math.max(b.scrollHeight + 2, 190), 560) + "px";
  }, [f.body]);

  const set = k => e => { setF(s => ({ ...s, [k]: e.target.value })); if (k === "body") { setAiMade(false); setHint(""); } };
  const has = f.body.trim().length > 0;
  const toState = !f.to.trim() ? null : recipientsOk(f.to);

  const stats = useMemo(() => {
    const words = f.body.trim() ? f.body.trim().split(/\s+/).length : 0;
    return { words, mins: Math.max(1, Math.ceil(words / 200)) };
  }, [f.body]);

  const quality = useMemo(() => {
    const t = f.body.trim();
    if (!t) return [0, 0, 0];
    const greet = /^(dear|hi|hello|janab|assalam)/i.test(t), close = /(regards|sincerely|thanks|thank you|shukriya|best)/i.test(t);
    const paras = t.split(/\n\s*\n/).filter(Boolean).length;
    return [
      35 + (greet ? 30 : 0) + (close ? 25 : 0) + (f.subject.trim() ? 10 : 0),
      t.length < 60 ? 45 : t.length > 1800 ? 65 : 92,
      Math.min(100, 25 + paras * 20 + (greet ? 10 : 0) + (close ? 10 : 0)),
    ];
  }, [f.body, f.subject]);

  /* ----- actions ----- */
  function applyTemplate(key) {
    const t = TEMPLATES[key || "blank"];
    setTpl(key === "blank" ? "" : key);
    setF(s => ({ ...s, subject: t.subject, body: signature ? t.body.replaceAll("[Your name]", signature) : t.body }));
    setAiMade(false);
    bodyRef.current?.focus();
  }

  async function aiTask(from) {
    const mode = { subject: "subject", improve: "improve", shorten: "shorten", expand: "expand" }[from] || "full";
    const idea = from === "regen" && lastIdea ? lastIdea : f.body.trim();
    if (!idea) { setHint("Describe your idea first, then generate."); toast.error("Add your idea in the message box first."); bodyRef.current?.focus(); return; }
    if (mode === "full") setLastIdea(idea);
    setUndo({ subject: f.subject, body: f.body });
    setBusy(from);
    try {
      const out = await runAI(mode, { idea, to: f.to.trim(), subject: mode === "subject" ? "" : f.subject.trim(), signature, ...opt });
      setF(s => ({
        ...s,
        ...(out.subject && mode !== "improve" ? { subject: out.subject } : {}),
        ...(out.body && mode !== "subject" ? { body: out.body } : {}),
      }));
      if (mode !== "subject") setAiMade(true);
      toast.success(mode === "subject" ? "Subject generated." : "Done. Review your email below.");
    } catch { toast.error("AI request failed. Check AI_ENDPOINT and try again."); }
    finally { setBusy(""); }
  }

  const undoLast = () => { if (undo) { setF(s => ({ ...s, ...undo })); setUndo(null); setAiMade(false); toast("Restored previous version."); } };

  const openMail = () =>
    (window.location.href = "mailto:" + encodeURIComponent(f.to.trim()) + "?subject=" + encodeURIComponent(f.subject) + "&body=" + encodeURIComponent(f.body));

  async function copyDraft() {
    try { await navigator.clipboard.writeText(`To: ${f.to}\nSubject: ${f.subject}\n\n${f.body}`); toast.success("Draft copied."); }
    catch { toast.error("Copy failed. Select the text and copy it manually."); }
  }

  async function startWorkflow() {
    if (!/^https?:\/\//i.test(WEBHOOK_URL)) return toast.error("WEBHOOK_URL set karein.");
    if (!recipientsOk(f.to)) { toast.error("Enter a valid recipient email first."); return; }
    if (!has) { toast.error("Write a message before starting the workflow."); return; }
    setBusy("send");
    const t = toast.loading("Starting workflow...");
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: f.to.trim(), subject: f.subject, body: f.body, sentAt: new Date().toISOString() }),
      });
      res.ok ? toast.success("Workflow started.", { id: t }) : toast.error("Webhook returned error " + res.status + ".", { id: t });
    } catch { toast.error("Could not reach the webhook. Check the URL and that it allows CORS.", { id: t }); }
    finally { setBusy(""); }
  }

  function clearAll() {
    setF({ to: "", subject: "", body: "" }); setTpl(""); setLastIdea(""); setAiMade(false); setUndo(null); setHint("");
    toast("Form cleared.");
  }

  function saveDraft() {
    if (!has && !f.subject.trim()) return toast.error("Nothing to save yet.");
    setHistory(h => [{ id: Date.now(), ...f }, ...h].slice(0, 20));
    toast.success("Draft saved to history.");
  }

  function download() {
    if (!has) return toast.error("Nothing to download yet.");
    const eml = `To: ${f.to}\nSubject: ${f.subject}\nContent-Type: text/plain; charset=UTF-8\n\n${f.body}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([eml], { type: "message/rfc822" }));
    a.download = (f.subject.trim().replace(/[^\w-]+/g, "_").slice(0, 40) || "draft") + ".eml";
    a.click(); URL.revokeObjectURL(a.href);
  }

  // Ctrl/Cmd+Enter = generate, Ctrl/Cmd+S = save draft (re-registered each render to avoid stale state)
  useEffect(() => {
    const h = e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "Enter") { e.preventDefault(); if (!busy) aiTask("generate"); }
      if (e.key.toLowerCase() === "s") { e.preventDefault(); saveDraft(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme:dark)").matches;
  const off = !!busy;

  return (
    <>
      <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: 12, background: "var(--ink)", color: "var(--bg)", fontSize: ".86rem" } }} />

      <header className="top">
        <div className="top-in">
          <div className="brand">
            <div className="logo"><Mail className="i" /></div>
            <div><b>MailCraft AI</b><small>Professional Email Assistant</small></div>
          </div>
          <div className="tools">
            <button className="icon-btn" aria-label="Toggle theme" title="Theme" onClick={() => setTheme(dark ? "light" : "dark")}>
              {dark ? <Sun className="i" /> : <Moon className="i" />}
            </button>
            <button className="icon-btn" aria-label="Help" title="Help" onClick={() => toast("Template chunein ya idea likhein, generate karein, review karein, phir copy ya mail app mein kholein. Shortcuts: Ctrl+Enter generate, Ctrl+S save.", { icon: "💡", duration: 5000 })}>
              <HelpCircle className="i" />
            </button>
            <button className="icon-btn avatar" aria-label="Profile" title="Profile" onClick={() => document.getElementById("sig")?.focus()}>
              <User className="i" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <span className="badge"><Sparkles className="i" style={{ width: 14, height: 14 }} />AI-Powered Email Writing</span>
          <h1>Write better emails, faster.</h1>
          <p>Turn your ideas into clear, professional, and ready-to-send emails with AI.</p>
          <div className="feats">
            {["Smart Email Generation", "Professional Writing", "Instant Refinement"].map(t => <span key={t}><Check className="i" />{t}</span>)}
          </div>
        </section>

        <section className="quick" aria-labelledby="qh">
          <h2 id="qh">Quick Start</h2>
          <div className="qgrid">
            {QUICK.map(([k, label, Icon]) => (
              <button key={k} className="qcard" onClick={() => { applyTemplate(k); document.querySelector(".wrap")?.scrollIntoView({ behavior: "smooth" }); }}>
                <span className="qi"><Icon className="i" /></span>{label}
              </button>
            ))}
          </div>
        </section>

        <div className="wrap">
          {/* Composer */}
          <section className="card" aria-labelledby="ch">
            <div className="card-head"><h2 id="ch">Create Email</h2></div>

            <label htmlFor="tpl" className="first">Template</label>
            <select id="tpl" value={tpl} onChange={e => applyTemplate(e.target.value || "blank")}>
              {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k === "blank" ? "" : k}>{t.label}</option>)}
            </select>

            <label htmlFor="to">Recipient <span style={{ fontWeight: 400 }}>(comma se multiple)</span></label>
            <input id="to" type="text" inputMode="email" placeholder="name@example.com" autoComplete="email"
              className={toState === null ? "" : toState ? "good" : "bad"} value={f.to} onChange={set("to")} />
            <div className="hint">
              <span className={"vstate" + (toState === null ? "" : toState ? " ok" : " no")}>
                {toState === null ? null : toState ? <><Check className="i" />Valid email address</> : <><X className="i" />Check the email address</>}
              </span>
            </div>

            <label htmlFor="subject">Subject</label>
            <div className="field">
              <input id="subject" type="text" placeholder="Describe what this email is about..." value={f.subject} onChange={set("subject")} />
              <button type="button" className="btn ai" disabled={off} onClick={() => aiTask("subject")}>✨ Generate Subject</button>
            </div>

            <label htmlFor="body">Email Message</label>
            <textarea id="body" ref={bodyRef} maxLength={5000} value={f.body} onChange={set("body")}
              placeholder="Describe your idea, request, update, or purpose..." />
            <div className="hint">
              <span style={hint ? { color: "var(--err)" } : undefined}>{hint}</span>
              <span className="stats"><span>{stats.words} words</span><span>~{stats.mins} min read</span><span>{f.body.length} / 5000</span></span>
            </div>

            <div className="three">
              {[["tone", "Tone", ["Professional", "Friendly", "Formal", "Persuasive", "Apologetic", "Concise"]],
                ["length", "Length", ["Short", "Medium", "Detailed"]],
                ["language", "Language", ["English", "Roman Urdu", "Urdu"]]].map(([k, label, opts]) => (
                <div key={k}>
                  <label htmlFor={k}>{label}</label>
                  <select id={k} value={opt[k]} onChange={e => setOpt(o => ({ ...o, [k]: e.target.value }))}>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="sigrow">
              <input id="sig" placeholder="Your signature name (auto-fills [Your name])" aria-label="Signature name"
                value={signature} onChange={e => setSignature(e.target.value)} />
              <button type="button" className="btn sm" onClick={() => { if (!signature) return toast.error("Pehle signature name likhein."); setF(s => ({ ...s, body: s.body.replaceAll("[Your name]", signature) })); }}>Apply</button>
            </div>

            <div className="chips" role="group" aria-label="Refine writing">
              <button type="button" className="btn ai sm" disabled={off} onClick={() => aiTask("genEmail")}>✨ Generate Email</button>
              <button type="button" className="btn sm" disabled={off} onClick={() => aiTask("improve")}>Improve Writing</button>
              <button type="button" className="btn sm" disabled={off} onClick={() => aiTask("professional")}>Make Professional</button>
              <button type="button" className="btn sm" disabled={off} onClick={() => aiTask("shorten")}>Shorten</button>
              <button type="button" className="btn sm" disabled={off} onClick={() => aiTask("expand")}>Expand</button>
              <button type="button" className="btn sm" disabled={!undo || off} onClick={undoLast}><Undo2 className="i" style={{ width: 15, height: 15 }} />Undo</button>
            </div>

            <button type="button" className={"btn primary big" + (busy === "generate" ? " busy" : "")} disabled={off} onClick={() => aiTask("generate")}>
              <span className="spin" /><Sparkles className="i ico" />
              <span>{busy === "generate" ? "AI is writing your email..." : "✨ Generate Professional Email"}</span>
            </button>

            <div className="row inline">
              <button className="btn" disabled={off} onClick={startWorkflow}><Send className="i" />Start workflow</button>
              <button className="btn" onClick={openMail}><Mail className="i" />Open in mail app</button>
              <button className="btn" onClick={copyDraft}><Copy className="i" />Copy draft</button>
              <button className="btn" onClick={saveDraft}><Save className="i" />Save draft</button>
              <button className="btn" onClick={clearAll}><Trash2 className="i" />Clear</button>
            </div>
          </section>

          {/* Preview */}
          <section className={"card preview-card" + (["generate", "genEmail", "professional", "regen"].includes(busy) ? " generating" : "")} aria-labelledby="ph" aria-live="polite">
            <div className="card-head">
              <h2 id="ph">Email Preview</h2>
              <span className={"status" + (aiMade && has ? " ai" : "")}>{!has ? "Draft" : aiMade ? "AI Generated" : "Edited"}</span>
            </div>

            <div className="paper">
              <dl className="meta" style={{ margin: 0 }}>
                <div><dt>To:</dt><dd id="pTo" className={f.to.trim() ? "" : "empty"}>{f.to.trim() || "(no recipient)"}</dd></div>
                <div><dt>Subject:</dt><dd id="pSubject" className={f.subject.trim() ? "" : "empty"}>{f.subject.trim() || "(no subject)"}</dd></div>
              </dl>
              <div className="skel" aria-hidden="true"><i style={{ width: "40%" }} /><i /><i /><i style={{ width: "85%" }} /><i style={{ width: "60%" }} /></div>
              <AnimatePresence mode="wait" initial={false}>
                {has ? (
                  <motion.pre key="body" id="pBody" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    {f.body}
                  </motion.pre>
                ) : (
                  <motion.div key="zero" className="zero show" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="art"><Mail className="i" /></div>
                    <h3>Your professional email will appear here</h3>
                    <p>Enter your idea and let AI turn it into a polished email.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="row inline">
              <button className="btn sm" onClick={copyDraft}><Copy className="i" />Copy</button>
              <button className="btn sm" onClick={openMail}><Mail className="i" />Open in Mail</button>
              <button className="btn sm" disabled={off} onClick={() => aiTask("regen")}><RotateCw className="i" />Regenerate</button>
              <button className="btn sm" onClick={() => bodyRef.current?.focus()}><Pencil className="i" />Edit</button>
              <button className="btn sm" onClick={download}><Download className="i" />.eml</button>
            </div>

            <div className="quality" aria-label="Email quality">
              <h3>Email Quality</h3>
              {["Professional", "Clear", "Well Structured"].map((n, i) => (
                <div className="qrow" key={n}>
                  <span>{n}</span>
                  <div className="bar"><b style={{ width: quality[i] + "%" }} /></div>
                  <span>{quality[i]}%</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* History */}
        <section className="hist" aria-labelledby="hh">
          <div className="card-head"><h2 id="hh" style={{ display: "flex", gap: 8, alignItems: "center" }}><History className="i" />Saved Drafts</h2>
            {history.length > 0 && <button className="btn sm" onClick={() => { setHistory([]); toast("History cleared."); }}>Clear all</button>}
          </div>
          {history.length === 0 ? (
            <div className="noh">Abhi koi draft save nahi hua. “Save draft” ya Ctrl+S dabayein.</div>
          ) : (
            <div className="hgrid">
              {history.map(h => (
                <div className="hcard" key={h.id}>
                  <b>{h.subject || "(no subject)"}</b>
                  <small>{h.to || "(no recipient)"} · {new Date(h.id).toLocaleString()}</small>
                  <div className="row inline">
                    <button className="btn sm" onClick={() => { setF({ to: h.to, subject: h.subject, body: h.body }); setAiMade(false); window.scrollTo({ top: 0, behavior: "smooth" }); toast.success("Draft restored."); }}>Open</button>
                    <button className="btn sm" aria-label="Delete draft" onClick={() => setHistory(x => x.filter(i => i.id !== h.id))}><Trash2 className="i" style={{ width: 15, height: 15 }} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
