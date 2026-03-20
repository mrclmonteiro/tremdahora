"use client";

import { useEffect, useState } from "react";

type Announcement = {
  id: number;
  created_at: string;
  title: string;
  body: string;
  link: string | null;
  link_label: string | null;
  active: boolean;
  expires_at: string | null;
  storage_key: string;
};

const ICON_ALERT = (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="24" fill="rgba(255,149,0,0.12)" />
    <circle cx="24" cy="24" r="18" fill="rgba(255,149,0,0.18)" />
    <path d="M24 14v13" stroke="#FF9500" strokeWidth="2.8" strokeLinecap="round" />
    <circle cx="24" cy="33" r="1.8" fill="#FF9500" />
  </svg>
);

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [linkLabel, setLinkLabel] = useState("Confira as informações completas.");
  const [expiresAt, setExpiresAt] = useState("");
  const [storageKey, setStorageKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Check session
  useEffect(() => {
    try {
      const p = sessionStorage.getItem("admin_pw");
      if (p) setAuthed(true);
    } catch {}
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    // Validate against API
    const res = await fetch("/api/announcements", {
      headers: { "x-admin-password": password },
      method: "GET",
    });
    // If we get a 401 it means wrong pass — but GET is public so we need another check
    // Instead, just try a PATCH with a dummy to check auth
    const check = await fetch("/api/announcements", {
      method: "PATCH",
      headers: { "x-admin-password": password, "Content-Type": "application/json" },
      body: JSON.stringify({ id: -1, active: false }),
    });
    if (check.status === 401) {
      setAuthError("Senha incorreta.");
      return;
    }
    try { sessionStorage.setItem("admin_pw", password); } catch {}
    setAuthed(true);
    setAuthError("");
  }

  async function loadAnnouncements() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      setAnnouncements(data);
    } catch {
      setError("Erro ao carregar avisos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) loadAnnouncements();
  }, [authed]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !body || !storageKey) {
      setFormError("Título, texto e chave são obrigatórios.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const pw = sessionStorage.getItem("admin_pw") || password;
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "x-admin-password": pw, "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          link: link || null,
          link_label: link ? linkLabel : null,
          expires_at: expiresAt || null,
          storage_key: storageKey,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Erro ao criar aviso.");
        return;
      }
      setTitle(""); setBody(""); setLink(""); setLinkLabel("Confira as informações completas."); setExpiresAt(""); setStorageKey("");
      await loadAnnouncements();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: number, active: boolean) {
    const pw = sessionStorage.getItem("admin_pw") || password;
    await fetch("/api/announcements", {
      method: "PATCH",
      headers: { "x-admin-password": pw, "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    await loadAnnouncements();
  }

  async function handleDelete(id: number) {
    if (!confirm("Remover este aviso permanentemente?")) return;
    const pw = sessionStorage.getItem("admin_pw") || password;
    await fetch("/api/announcements", {
      method: "DELETE",
      headers: { "x-admin-password": pw, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAnnouncements();
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.82)",
    backdropFilter: "blur(28px) saturate(180%)",
    WebkitBackdropFilter: "blur(28px) saturate(180%)",
    border: "1px solid rgba(255,255,255,0.6)",
    boxShadow: "0 8px 40px rgba(0,0,0,0.10)",
    borderRadius: 24,
    padding: "28px 24px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(60,60,67,0.15)",
    background: "rgba(255,255,255,0.7)",
    fontSize: 14,
    color: "#1C1C1E",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(60,60,67,0.5)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
    display: "block",
  };

  const btnPrimary: React.CSSProperties = {
    background: "#007AFF",
    color: "white",
    border: "none",
    borderRadius: 99,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,122,255,0.35)",
  };

  if (!authed) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)", padding: 24,
      }}>
        <div style={{ ...cardStyle, maxWidth: 360, width: "100%", textAlign: "center" }}>
          <div style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>{ICON_ALERT}</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1C1E", margin: "0 0 6px" }}>Admin</h1>
          <p style={{ fontSize: 13, color: "rgba(60,60,67,0.5)", margin: "0 0 24px" }}>Trem da Hora</p>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              autoFocus
            />
            {authError && <p style={{ fontSize: 13, color: "#FF3B30", margin: 0 }}>{authError}</p>}
            <button type="submit" style={{ ...btnPrimary, width: "100%", padding: "13px" }}>
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", padding: "max(env(safe-area-inset-top), 32px) 20px 60px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1C1C1E", margin: 0, letterSpacing: "-0.5px" }}>Avisos</h1>
            <p style={{ fontSize: 13, color: "rgba(60,60,67,0.45)", margin: "4px 0 0" }}>Trem da Hora · Admin</p>
          </div>
          <button
            onClick={() => { try { sessionStorage.removeItem("admin_pw"); } catch {} setAuthed(false); setPassword(""); }}
            style={{ background: "rgba(60,60,67,0.08)", border: "none", borderRadius: 99, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "rgba(60,60,67,0.6)", cursor: "pointer" }}
          >
            Sair
          </button>
        </div>

        {/* Formulário novo aviso */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1C1C1E", margin: "0 0 20px" }}>Novo aviso</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Título</label>
              <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Alteração na operação" />
            </div>
            <div>
              <label style={labelStyle}>Texto</label>
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Mensagem exibida para o usuário..."
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Link (opcional)</label>
                <input style={inputStyle} value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label style={labelStyle}>Texto do link</label>
                <input style={inputStyle} value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="Confira as informações completas." />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Expira em (opcional)</label>
                <input style={inputStyle} type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Chave única</label>
                <input style={inputStyle} value={storageKey} onChange={e => setStorageKey(e.target.value)} placeholder="Ex: aviso_dnit_mar2026" />
                <p style={{ fontSize: 11, color: "rgba(60,60,67,0.4)", margin: "4px 0 0" }}>Usada no localStorage para não mostrar de novo</p>
              </div>
            </div>
            {formError && <p style={{ fontSize: 13, color: "#FF3B30", margin: 0 }}>{formError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" style={btnPrimary} disabled={saving}>
                {saving ? "Salvando..." : "Publicar aviso"}
              </button>
            </div>
          </form>
        </div>

        {/* Lista de avisos */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1C1C1E", margin: 0 }}>Avisos cadastrados</h2>
            <button onClick={loadAnnouncements} style={{ background: "rgba(60,60,67,0.08)", border: "none", borderRadius: 99, padding: "6px 14px", fontSize: 13, fontWeight: 600, color: "rgba(60,60,67,0.6)", cursor: "pointer" }}>
              Atualizar
            </button>
          </div>

          {loading && <p style={{ fontSize: 14, color: "rgba(60,60,67,0.45)", textAlign: "center", padding: "20px 0" }}>Carregando...</p>}
          {error && <p style={{ fontSize: 14, color: "#FF3B30" }}>{error}</p>}
          {!loading && announcements.length === 0 && (
            <p style={{ fontSize: 14, color: "rgba(60,60,67,0.4)", textAlign: "center", padding: "20px 0" }}>Nenhum aviso cadastrado ainda.</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {announcements.map(a => (
              <div key={a.id} style={{
                background: a.active ? "rgba(52,199,89,0.06)" : "rgba(60,60,67,0.04)",
                border: `1px solid ${a.active ? "rgba(52,199,89,0.2)" : "rgba(60,60,67,0.1)"}`,
                borderRadius: 16,
                padding: "16px",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                        color: a.active ? "#34C759" : "rgba(60,60,67,0.4)",
                        background: a.active ? "rgba(52,199,89,0.12)" : "rgba(60,60,67,0.08)",
                        borderRadius: 99, padding: "2px 8px",
                      }}>
                        {a.active ? "ATIVO" : "INATIVO"}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(60,60,67,0.35)" }}>#{a.id} · {fmt(a.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E", margin: "0 0 4px" }}>{a.title}</p>
                    <p style={{ fontSize: 13, color: "rgba(60,60,67,0.6)", margin: "0 0 4px", lineHeight: 1.4 }}>{a.body}</p>
                    {a.link && <p style={{ fontSize: 12, color: "#007AFF", margin: 0 }}>🔗 {a.link}</p>}
                    {a.expires_at && <p style={{ fontSize: 11, color: "rgba(60,60,67,0.4)", margin: "4px 0 0" }}>Expira: {fmt(a.expires_at)}</p>}
                    <p style={{ fontSize: 11, color: "rgba(60,60,67,0.35)", margin: "4px 0 0" }}>Chave: <code style={{ background: "rgba(60,60,67,0.08)", borderRadius: 4, padding: "1px 5px" }}>{a.storage_key}</code></p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => toggleActive(a.id, a.active)}
                      style={{ background: a.active ? "rgba(255,59,48,0.1)" : "rgba(52,199,89,0.1)", border: "none", borderRadius: 99, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: a.active ? "#FF3B30" : "#34C759", cursor: "pointer" }}
                    >
                      {a.active ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      style={{ background: "rgba(60,60,67,0.06)", border: "none", borderRadius: 99, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "rgba(60,60,67,0.45)", cursor: "pointer" }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
