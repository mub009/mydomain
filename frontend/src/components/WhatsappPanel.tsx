import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Smartphone,
  Trash2,
  Unlink,
  Upload,
  Users,
} from "lucide-react";
import { whatsappApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import {
  Business,
  Campaign,
  CampaignMessage,
  CAMPAIGN_STATUS_LABELS,
  Contact,
  ContactSummary,
  ImportResult,
  MessageTemplate,
  TEMPLATE_VARIABLES,
  WhatsappSession,
} from "@/types";
import { ListSkeleton, Spinner } from "@/components/Loading";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";

const TABS = ["Connection", "Contacts", "Templates", "Campaigns"] as const;
type Tab = (typeof TABS)[number];
const PAGE_SIZE = 20;

function displayPhone(phone: string): string {
  if (phone.length === 12 && phone.startsWith("91")) return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
  return `+${phone}`;
}

export default function WhatsappPanel({ business }: { business: Business }) {
  const [tab, setTab] = useState<Tab>("Connection");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <h3 className="flex items-center gap-1.5 font-bold text-ink-900">
          <MessageSquare size={16} className="text-brand-600" /> WhatsApp broadcasts
        </h3>
        <p className="mt-0.5 text-xs text-ink-500">
          Link your own WhatsApp number, import the customers who gave you theirs, write a message and send it.
        </p>

        <div className="mt-3 flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setNotice("");
                setError("");
              }}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-900"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {notice && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      {tab === "Connection" && <ConnectionTab business={business} onNotice={setNotice} onError={setError} />}
      {tab === "Contacts" && <ContactsTab business={business} onNotice={setNotice} onError={setError} />}
      {tab === "Templates" && <TemplatesTab business={business} onNotice={setNotice} onError={setError} />}
      {tab === "Campaigns" && <CampaignsTab business={business} onNotice={setNotice} onError={setError} />}
    </div>
  );
}

interface TabProps {
  business: Business;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}

// --- Connection -------------------------------------------------------------

function ConnectionTab({ business, onNotice, onError }: TabProps) {
  const [session, setSession] = useState<WhatsappSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      setSession(await whatsappApi.session(business.id));
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [business.id, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  // While a QR is on screen it has a short life and is replaced by WhatsApp
  // every 20s or so, so poll until the scan lands.
  useEffect(() => {
    if (session?.status !== "AWAITING_SCAN") return;
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [session?.status, load]);

  async function connect() {
    setWorking(true);
    onError("");
    try {
      setSession(await whatsappApi.connect(business.id));
      onNotice("Linking started. Scan the QR code with WhatsApp on your phone.");
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Unlink this WhatsApp account? Any campaign still sending will pause.")) return;
    setWorking(true);
    try {
      setSession(await whatsappApi.disconnect(business.id));
      onNotice("WhatsApp unlinked.");
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <Spinner label="Checking your WhatsApp connection…" />;
  if (!session) return null;

  const connected = session.status === "CONNECTED";

  return (
    <div className="space-y-3">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${
                connected ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
              }`}
            >
              <Smartphone size={20} />
            </span>
            <div>
              <p className="font-bold text-ink-900">
                {connected ? "WhatsApp connected" : session.status === "AWAITING_SCAN" ? "Waiting for scan" : "Not connected"}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                {connected && session.phoneNumber
                  ? `Sending as ${displayPhone(session.phoneNumber.replace(/[^0-9]/g, "")) }`
                  : "Messages go out from your own WhatsApp account, so replies come straight back to your phone."}
              </p>
              {connected && (
                <p className="mt-1 text-xs text-ink-500">
                  <strong className="text-ink-900">{session.sentToday}</strong> of {session.dailyLimit} messages sent
                  today
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {connected ? (
              <button onClick={disconnect} disabled={working} className="btn-secondary px-3 py-2 text-sm disabled:opacity-50">
                <Unlink size={14} /> Unlink
              </button>
            ) : (
              <button onClick={connect} disabled={working} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                <Link2 size={14} /> {working ? "Starting…" : "Link WhatsApp"}
              </button>
            )}
          </div>
        </div>

        {session.lastError && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{session.lastError}</p>
        )}

        {session.qrDataUrl && session.status === "AWAITING_SCAN" && (
          <div className="mt-4 flex flex-col items-center rounded-xl border border-gray-200 p-5">
            <img src={session.qrDataUrl} alt="WhatsApp linking QR code" className="h-56 w-56" />
            <p className="mt-3 max-w-sm text-center text-sm text-ink-600">
              On your phone open <strong>WhatsApp → Settings → Linked devices → Link a device</strong> and point the
              camera at this code.
            </p>
          </div>
        )}

        {session.transport === "log" && (
          <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-800">
            <strong>Test mode.</strong> This server is set to record messages instead of sending them, so you can try
            the whole flow safely. Set <code className="font-mono">WHATSAPP_TRANSPORT=webjs</code> to send for real.
          </p>
        )}
      </div>

      <div className="card p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
          <AlertTriangle size={15} className="text-amber-500" /> Before you send
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink-600">
          <li>Only message customers who gave you their number and expect to hear from you.</li>
          <li>
            Messages go out one at a time with a pause between them, and stop at {session.dailyLimit} a day. Sending
            faster is the quickest way to get a number restricted.
          </li>
          <li>Give people a way to stop — mark anyone who asks as opted out and they are never messaged again.</li>
          <li>This links a normal WhatsApp account. WhatsApp does not officially support bulk sending this way.</li>
        </ul>
      </div>
    </div>
  );
}

// --- Contacts ---------------------------------------------------------------

function ContactsTab({ business, onNotice, onError }: TabProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [summary, setSummary] = useState<ContactSummary>({ optedOut: 0, tags: [] });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappApi.contacts(business.id, {
        page,
        pageSize: PAGE_SIZE,
        ...(appliedSearch ? { search: appliedSearch } : {}),
        ...(tagFilter ? { tag: tagFilter } : {}),
      });
      setContacts(res.data);
      setSummary(res.summary);
      setTotalPages(res.meta.totalPages);
      setTotal(res.meta.total);
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [business.id, page, appliedSearch, tagFilter, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setUploading(true);
    setResult(null);
    onError("");
    try {
      const outcome = await whatsappApi.importContacts(business.id, file);
      setResult(outcome);
      onNotice(`Imported ${outcome.imported} new contacts.`);
      setPage(1);
      await load();
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function toggleOptOut(contact: Contact) {
    try {
      await whatsappApi.updateContact(business.id, contact.id, { optedOut: !contact.optedOut });
      await load();
    } catch (err) {
      onError(apiErrorMessage(err));
    }
  }

  async function remove(contact: Contact) {
    if (!window.confirm(`Delete ${contact.name}? To simply stop messaging them, mark them opted out instead.`)) return;
    try {
      await whatsappApi.deleteContact(business.id, contact.id);
      await load();
    } catch (err) {
      onError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
              <Users size={15} className="text-brand-600" /> Contacts
            </h4>
            <p className="mt-0.5 text-xs text-ink-500">
              Upload an Excel file (.xlsx) with a name and a phone column. Any column order works — headings like
              “Mobile No.” or “WhatsApp Number” are recognised.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(true)} className="btn-secondary px-3 py-2 text-sm">
              <Plus size={14} /> Add one
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
            >
              <Upload size={14} /> {uploading ? "Reading…" : "Upload Excel"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-gray-100 px-3 py-1.5 font-semibold text-ink-700">{total} contacts</span>
          {summary.optedOut > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
              {summary.optedOut} opted out
            </span>
          )}
          {summary.tags.map((t) => (
            <button
              key={t.tag}
              onClick={() => {
                setTagFilter(tagFilter === t.tag ? "" : t.tag);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${
                tagFilter === t.tag ? "bg-brand-600 text-white" : "bg-gray-100 text-ink-600 hover:bg-gray-200"
              }`}
            >
              {t.tag} ({t.count})
            </button>
          ))}
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(search.trim());
          }}
        >
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by name or number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-secondary px-4 py-2 text-sm">Search</button>
        </form>

        {result && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
            <p className="font-semibold text-ink-900">
              {result.imported} added · {result.updated} already known · {result.duplicatesInFile} repeated in the file ·{" "}
              {result.skipped} unusable
            </p>
            {result.stillOptedOut > 0 && (
              <p className="mt-1 text-amber-700">
                {result.stillOptedOut} of those had opted out before — they stay opted out and will not be messaged.
              </p>
            )}
            {result.problems.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-ink-600">
                {result.problems.map((p) => (
                  <li key={p.row}>
                    Row {p.row}: “{p.value}” — {p.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : contacts.length === 0 ? (
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <FileSpreadsheet size={22} />
          </span>
          <p className="mt-3 font-semibold text-ink-900">No contacts yet</p>
          <p className="mt-1 text-sm text-ink-500">Upload a spreadsheet, or add someone by hand to get started.</p>
        </div>
      ) : (
        <>
          <div className="card divide-y divide-gray-100">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-[10rem] flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    {contact.name}
                    {contact.optedOut && <span className="badge bg-amber-50 text-amber-700">Opted out</span>}
                    {contact.tag && <span className="badge bg-gray-100 text-gray-600">{contact.tag}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {displayPhone(contact.phone)}
                    {contact.email ? ` · ${contact.email}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleOptOut(contact)} className="btn-secondary px-2.5 py-1.5 text-xs">
                    {contact.optedOut ? <CheckCircle2 size={13} /> : <Ban size={13} />}
                    {contact.optedOut ? "Opt back in" : "Opt out"}
                  </button>
                  <button
                    onClick={() => remove(contact)}
                    className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${contact.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {adding && (
        <AddContactModal
          business={business}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            setPage(1);
            void load();
          }}
          onError={onError}
        />
      )}
    </div>
  );
}

function AddContactModal({
  business,
  onClose,
  onAdded,
  onError,
}: {
  business: Business;
  onClose: () => void;
  onAdded: () => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", tag: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await whatsappApi.addContact(business.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        tag: form.tag.trim() || undefined,
      });
      onAdded();
    } catch (err) {
      setFormError(apiErrorMessage(err));
      onError("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add a contact" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-700">Name *</span>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-700">WhatsApp number *</span>
          <input
            required
            className="input"
            placeholder="9876543210"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <span className="mt-1 block text-[11px] text-ink-400">
            A 10-digit number is treated as Indian. Include the country code for anywhere else.
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-700">Email</span>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-700">Tag</span>
            <input className="input" placeholder="regular" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
          </label>
        </div>
        {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? "Adding…" : "Add contact"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Templates --------------------------------------------------------------

function TemplatesTab({ business, onNotice, onError }: TabProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await whatsappApi.templates(business.id));
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [business.id, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(template: MessageTemplate) {
    if (!window.confirm(`Delete the “${template.name}” template?`)) return;
    try {
      await whatsappApi.deleteTemplate(business.id, template.id);
      onNotice("Template deleted.");
      await load();
    } catch (err) {
      onError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-ink-900">Message templates</h4>
            <p className="mt-0.5 text-xs text-ink-500">
              Save the messages you send often. Use {"{{name}}"} and the other placeholders to greet each person by
              name.
            </p>
          </div>
          <button onClick={() => setCreating(true)} className="btn-primary px-3 py-2 text-sm">
            <Plus size={14} /> New template
          </button>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : templates.length === 0 ? (
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <MessageSquare size={22} />
          </span>
          <p className="mt-3 font-semibold text-ink-900">No templates yet</p>
          <p className="mt-1 text-sm text-ink-500">Write one now and reuse it every time you run an offer.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <div key={template.id} className="card flex flex-col p-4">
              <p className="text-sm font-bold text-ink-900">{template.name}</p>
              <p className="mt-2 flex-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-ink-700">
                {template.body}
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setEditing(template)} className="btn-secondary flex-1 px-3 py-1.5 text-xs">
                  Edit
                </button>
                <button
                  onClick={() => remove(template)}
                  className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Delete ${template.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <TemplateModal
          business={business}
          template={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            onNotice("Template saved.");
            void load();
          }}
        />
      )}
    </div>
  );
}

function TemplateModal({
  business,
  template,
  onClose,
  onSaved,
}: {
  business: Business;
  template: MessageTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: template?.name ?? "", body: template?.body ?? "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  function insertVariable(variable: string) {
    const textarea = bodyRef.current;
    const token = `{{${variable}}}`;
    if (!textarea) {
      setForm((f) => ({ ...f, body: f.body + token }));
      return;
    }
    const start = textarea.selectionStart ?? form.body.length;
    const end = textarea.selectionEnd ?? start;
    const next = form.body.slice(0, start) + token + form.body.slice(end);
    setForm((f) => ({ ...f, body: next }));
    // Put the caret after what we just dropped in, so typing continues there.
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (template) await whatsappApi.updateTemplate(business.id, template.id, form);
      else await whatsappApi.createTemplate(business.id, form);
      onSaved();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const preview = form.body
    .replace(/\{\{\s*name\s*\}\}/gi, "Anil")
    .replace(/\{\{\s*business\s*\}\}/gi, business.name)
    .replace(/\{\{\s*city\s*\}\}/gi, business.city)
    .replace(/\{\{\s*phone\s*\}\}/gi, "+91 98765 43210");

  return (
    <Modal title={template ? `Edit ${template.name}` : "New template"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-700">Template name *</span>
          <input
            required
            className="input"
            placeholder="Diwali offer"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        <div>
          <span className="mb-1 block text-xs font-semibold text-ink-700">Message *</span>
          <textarea
            ref={bodyRef}
            required
            rows={5}
            className="input"
            placeholder="Hi {{name}}, we have 20% off this week!"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-ink-500">Insert:</span>
            {TEMPLATE_VARIABLES.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                className="rounded-full bg-gray-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-700 hover:bg-gray-200"
              >
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
        </div>

        {form.body && (
          <div>
            <span className="mb-1 block text-xs font-semibold text-ink-700">Preview</span>
            <p className="whitespace-pre-wrap rounded-lg bg-[#dcf8c6] p-3 text-sm leading-relaxed text-ink-900">
              {preview}
            </p>
          </div>
        )}

        {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? "Saving…" : "Save template"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Campaigns --------------------------------------------------------------

const CAMPAIGN_TINT: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENDING: "bg-blue-50 text-blue-700",
  PAUSED: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

function CampaignsTab({ business, onNotice, onError }: TabProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await whatsappApi.campaigns(business.id, { page, pageSize: 10 });
      setCampaigns(res.data);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [business.id, page, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  // A campaign in flight moves on its own, so refresh while one is running.
  useEffect(() => {
    if (!campaigns.some((c) => c.status === "SENDING")) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [campaigns, load]);

  async function start(campaign: Campaign) {
    try {
      await whatsappApi.startCampaign(business.id, campaign.id);
      onNotice(`“${campaign.name}” is sending. Messages go out one at a time.`);
      await load();
    } catch (err) {
      onError(apiErrorMessage(err));
    }
  }

  async function setStatus(campaign: Campaign, status: string) {
    try {
      await whatsappApi.setCampaignStatus(business.id, campaign.id, status);
      await load();
    } catch (err) {
      onError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-ink-900">Campaigns</h4>
            <p className="mt-0.5 text-xs text-ink-500">
              Pick who to message and send. Anyone who opted out is left out automatically.
            </p>
          </div>
          <button onClick={() => setCreating(true)} className="btn-primary px-3 py-2 text-sm">
            <Send size={14} /> New campaign
          </button>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : campaigns.length === 0 ? (
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Send size={22} />
          </span>
          <p className="mt-3 font-semibold text-ink-900">No campaigns yet</p>
          <p className="mt-1 text-sm text-ink-500">Import some contacts, write a message, and send your first one.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {campaigns.map((campaign) => {
              const done = campaign.sentCount + campaign.failedCount + campaign.skippedCount;
              const percent = campaign.totalCount === 0 ? 0 : Math.round((done / campaign.totalCount) * 100);
              return (
                <div key={campaign.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[12rem] flex-1">
                      <p className="flex items-center gap-2 text-sm font-bold text-ink-900">
                        {campaign.name}
                        <span className={`badge ${CAMPAIGN_TINT[campaign.status]}`}>
                          {CAMPAIGN_STATUS_LABELS[campaign.status]}
                        </span>
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{campaign.body}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(campaign.status === "DRAFT" || campaign.status === "PAUSED") && (
                        <button onClick={() => start(campaign)} className="btn-primary px-3 py-1.5 text-xs">
                          <Play size={13} /> {campaign.status === "PAUSED" ? "Resume" : "Send"}
                        </button>
                      )}
                      {campaign.status === "SENDING" && (
                        <button onClick={() => setStatus(campaign, "PAUSED")} className="btn-secondary px-3 py-1.5 text-xs">
                          <Pause size={13} /> Pause
                        </button>
                      )}
                      {campaign.status !== "COMPLETED" && campaign.status !== "CANCELLED" && (
                        <button onClick={() => setStatus(campaign, "CANCELLED")} className="btn-secondary px-3 py-1.5 text-xs">
                          Cancel
                        </button>
                      )}
                      <button onClick={() => setOpen(campaign)} className="btn-secondary px-3 py-1.5 text-xs">
                        Details
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-500">
                      {campaign.sentCount} sent
                      {campaign.failedCount > 0 && ` · ${campaign.failedCount} failed`}
                      {campaign.skippedCount > 0 && ` · ${campaign.skippedCount} skipped`} of {campaign.totalCount}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {creating && (
        <NewCampaignModal
          business={business}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            onNotice("Campaign ready. Press Send when you are.");
            void load();
          }}
        />
      )}

      {open && <CampaignDetail business={business} campaign={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function NewCampaignModal({
  business,
  onClose,
  onCreated,
}: {
  business: Business;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [form, setForm] = useState({ name: "", body: "", templateId: "", tag: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    void whatsappApi.templates(business.id).then(setTemplates).catch(() => undefined);
    void whatsappApi
      .contacts(business.id, { pageSize: 1 })
      .then((r) => setTags(r.summary.tags))
      .catch(() => undefined);
  }, [business.id]);

  function pickTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    setForm((f) => ({
      ...f,
      templateId,
      body: template ? template.body : f.body,
      name: f.name || (template ? template.name : ""),
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await whatsappApi.createCampaign(business.id, {
        name: form.name.trim(),
        body: form.body,
        templateId: form.templateId || undefined,
        tag: form.tag || undefined,
      });
      onCreated();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New campaign" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-700">Campaign name *</span>
          <input
            required
            className="input"
            placeholder="Diwali offer — regulars"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        {templates.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-700">Start from a template</span>
            <select className="input" value={form.templateId} onChange={(e) => pickTemplate(e.target.value)}>
              <option value="">Write a new message</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-700">Message *</span>
          <textarea
            required
            rows={4}
            className="input"
            placeholder="Hi {{name}}, we have 20% off this week!"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-700">Send to</span>
          <select className="input" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
            <option value="">Everyone in my contacts</option>
            {tags.map((t) => (
              <option key={t.tag} value={t.tag}>
                {t.tag} ({t.count})
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-ink-400">
            Anyone who has opted out is excluded, whichever audience you pick.
          </span>
        </label>

        {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? "Preparing…" : "Create campaign"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const MESSAGE_TINT: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  SENT: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
  SKIPPED: "bg-amber-50 text-amber-700",
};

function CampaignDetail({
  business,
  campaign,
  onClose,
}: {
  business: Business;
  campaign: Campaign;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    whatsappApi
      .campaign(business.id, campaign.id, { page, pageSize: PAGE_SIZE })
      .then((res) => {
        setMessages(res.data.messages);
        setTotalPages(res.meta.totalPages);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [business.id, campaign.id, page]);

  return (
    <Modal title={campaign.name} onClose={onClose}>
      <div className="space-y-3">
        <p className="whitespace-pre-wrap rounded-lg bg-[#dcf8c6] p-3 text-sm leading-relaxed text-ink-900">
          {campaign.body}
        </p>

        {loading ? (
          <Spinner label="Loading recipients…" />
        ) : (
          <>
            <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
              {messages.map((message) => (
                <div key={message.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{message.name}</p>
                    <p className="text-xs text-ink-500">{displayPhone(message.phone)}</p>
                    {message.error && <p className="mt-0.5 text-[11px] text-red-600">{message.error}</p>}
                  </div>
                  <span className={`badge ${MESSAGE_TINT[message.status]}`}>{message.status.toLowerCase()}</span>
                </div>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </Modal>
  );
}
