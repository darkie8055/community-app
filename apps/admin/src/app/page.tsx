"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  Download,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
  Clock3,
  Package,
  Car,
  Wrench,
  CircleCheck,
  Menu,
  Loader2,
} from "lucide-react";
import {
  API,
  request,
  User,
  Community,
  Visit,
  Member,
  Structure,
  Overview,
  Audit,
  time,
  date,
} from "@/lib/api";
import { CommunityAdmin } from "./community-admin";

type View =
  | "overview"
  | "society"
  | "memberships"
  | "visitors"
  | "audit"
  | "communities"
  | "catalog"
  | "services"
  | "staff";
type FormKind = "community" | "block" | "floor" | "unit";
const nav: { key: View; name: string; icon: typeof Home }[] = [
  { key: "overview", name: "Overview", icon: LayoutDashboard },
  { key: "society", name: "Society & homes", icon: Building2 },
  { key: "memberships", name: "Residents", icon: Users },
  { key: "visitors", name: "Visitor logs", icon: DoorOpen },
  { key: "catalog", name: "Community & listings", icon: Home },
  { key: "services", name: "Service requests", icon: Wrench },
  { key: "staff", name: "Security team", icon: ShieldCheck },
  { key: "audit", name: "Activity log", icon: ClipboardList },
];
function Mark() {
  return (
    <div className="mark">
      <Home size={23} strokeWidth={2.5} />
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value}`}>
      <i />
      {value === "pending"
        ? "Waiting"
        : value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <CircleCheck size={32} />
      <h3>All clear here</h3>
      <p>{text}</p>
    </div>
  );
}
function VisitorIcon({ type }: { type: string }) {
  const Icon =
    type === "delivery"
      ? Package
      : type === "cab"
        ? Car
        : type === "service"
          ? Wrench
          : Users;
  return (
    <div className={`visitor-icon ${type}`}>
      <Icon size={18} />
    </div>
  );
}

export default function Dashboard() {
  const [session, setSession] = useState<{ token: string; user: User } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [community, setCommunity] = useState("");
  const [view, setView] = useState<View>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [structure, setStructure] = useState<Structure>({
    blocks: [],
    floors: [],
    units: [],
  });
  const [visits, setVisits] = useState<Visit[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [memberFilter, setMemberFilter] = useState("pending");
  const [selectedBlock, setSelectedBlock] = useState("");
  const [modal, setModal] = useState<FormKind | null>(null);
  const [detail, setDetail] = useState<Visit | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [health, setHealth] = useState<{
    mode: string;
    redis: string;
    push: string;
  } | null>(null);
  const generation = useRef(0);
  const visitGeneration = useRef(0);
  const selected = communities.find((c) => c.id === community);
  const signOut = useCallback(() => {
    sessionStorage.removeItem("mycommunity.admin");
    setSession(null);
    setCommunity("");
    setOverview(null);
    setMembers([]);
    setVisits([]);
    setError("");
    generation.current++;
    visitGeneration.current++;
  }, []);
  useEffect(() => {
    try {
      const value = sessionStorage.getItem("mycommunity.admin");
      if (value) setSession(JSON.parse(value));
    } catch {}
    setReady(true);
    window.addEventListener("session-expired", signOut);
    return () => window.removeEventListener("session-expired", signOut);
  }, [signOut]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const loadCommunities = useCallback(async () => {
    if (!session) return;
    const rows = await request<Community[]>("/communities", session.token);
    setCommunities(rows);
    setCommunity((c) => (rows.some((r) => r.id === c) ? c : rows[0]?.id || ""));
  }, [session]);
  useEffect(() => {
    loadCommunities().catch((e) => setError(e.message));
    request<{ mode: string; redis: string; push: string }>("/health")
      .then(setHealth)
      .catch(() => {});
  }, [loadCommunities]);
  const refresh = useCallback(
    async (quiet = false) => {
      if (!session || !community) return;
      const ticket = ++generation.current;
      if (!quiet) setLoading(true);
      setError("");
      try {
        const base = `/communities/${community}`;
        const [o, m, s, a] = await Promise.all([
          request<Overview>(`${base}/overview`, session.token),
          request<Member[]>(`${base}/memberships`, session.token),
          request<Structure>(`${base}/structure`, session.token),
          request<Audit[]>(`${base}/audit-logs`, session.token),
        ]);
        if (ticket !== generation.current) return;
        setOverview(o);
        setMembers(m);
        setStructure(s);
        setAudit(a);
        setSelectedBlock((b) =>
          s.blocks.some((x) => x.id === b) ? b : s.blocks[0]?.id || "",
        );
      } catch (e) {
        if (ticket === generation.current) setError((e as Error).message);
      } finally {
        if (ticket === generation.current) setLoading(false);
      }
    },
    [session, community],
  );
  useEffect(() => {
    setOverview(null);
    setMembers([]);
    setStructure({ blocks: [], floors: [], units: [] });
    setAudit([]);
    setDetail(null);
    setModal(null);
    void refresh();
    const id = setInterval(() => void refresh(true), 15000);
    return () => {
      clearInterval(id);
      generation.current++;
    };
  }, [refresh]);
  const loadVisits = useCallback(
    async (cursor?: string) => {
      if (!session || !community) return;
      const ticket = ++visitGeneration.current;
      const q = new URLSearchParams({ limit: "50" });
      if (search) q.set("search", search);
      if (status) q.set("status", status);
      if (cursor) q.set("cursor", cursor);
      try {
        const result = await request<{
          items: Visit[];
          next_cursor: string | null;
        }>(`/communities/${community}/visitor-entries?${q}`, session.token);
        if (ticket !== visitGeneration.current) return;
        setVisits((old) =>
          cursor
            ? [
                ...old,
                ...result.items.filter((v) => !old.some((o) => o.id === v.id)),
              ]
            : result.items,
        );
        setNextCursor(result.next_cursor);
      } catch (e) {
        if (ticket === visitGeneration.current) setError((e as Error).message);
      }
    },
    [session, community, search, status],
  );
  useEffect(() => {
    visitGeneration.current++;
    setVisits([]);
    setNextCursor(null);
    const id = setTimeout(() => void loadVisits(), 250);
    return () => {
      clearTimeout(id);
      visitGeneration.current++;
    };
  }, [loadVisits]);
  useEffect(() => {
    if (!modal && !detail) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,[tabindex="0"]',
        ) || [],
      );
    const first = focusables()[0];
    if (first && !dialog?.contains(document.activeElement)) first.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        setModal(null);
        setDetail(null);
      }
      if (e.key === "Tab") {
        const items = focusables();
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [modal, detail, busy]);
  function navigate(next: View) {
    setView(next);
    setMobileMenu(false);
    setError("");
    if (next === "visitors") void loadVisits();
  }
  async function decide(member: Member, decision: string) {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await request(
        `/communities/${community}/memberships/${member.id}/decision`,
        session.token,
        { method: "POST", body: JSON.stringify({ status: decision }) },
      );
      setToast(
        `${member.name} ${decision === "approved" ? "is now a community member" : "was declined"}.`,
      );
      await refresh(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !modal) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if ("number" in data)
      data.number = Number(data.number) as unknown as string;
    setBusy(true);
    setError("");
    try {
      const path =
        modal === "community"
          ? "/communities"
          : `/communities/${community}/${modal === "block" ? "blocks" : modal === "floor" ? "floors" : "units"}`;
      const result = await request<Community>(path, session.token, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setModal(null);
      setToast(
        `${modal === "community" ? "Society" : modal.charAt(0).toUpperCase() + modal.slice(1)} created successfully.`,
      );
      if (modal === "community") {
        await loadCommunities();
        setCommunity(result.id);
        setView("society");
      } else await refresh(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    const clean = (s: unknown) =>
      `"${String(s ?? "")
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""')}"`;
    const rows = [
      ["Visitor", "Type", "Flat", "Status", "Registered", "Entry", "Exit"],
      ...visits.map((v) => [
        v.name,
        v.type,
        v.unit,
        v.status,
        v.created_at,
        v.entered_at,
        v.exited_at,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((r) => r.map(clean).join(",")).join("\r\n")], {
        type: "text/csv",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "visitor-log.csv";
    a.click();
    URL.revokeObjectURL(url);
    setToast(`Exported ${visits.length} loaded visits.`);
  }
  if (!ready) return <div className="boot">Opening your community…</div>;
  if (!session)
    return (
      <Login
        onLogin={(value) => {
          sessionStorage.setItem("mycommunity.admin", JSON.stringify(value));
          setSession(value);
        }}
      />
    );
  const pending = members.filter((m) => m.status === "pending");
  return (
    <div className="app-layout">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <Mark />
          <span>
            my<span>community</span>
          </span>
        </a>
        <div className="workspace-label">SOCIETY MANAGEMENT</div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.key}
              className={view === item.key ? "active" : ""}
              onClick={() => navigate(item.key)}
            >
              <item.icon size={19} />
              <span>{item.name}</span>
              {item.key === "memberships" && pending.length > 0 && (
                <b>{pending.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="safety-card">
            <ShieldCheck size={25} />
            <h4>
              Better communities.
              <br />
              Happier everyday.
            </h4>
            <p>A little care makes a big difference.</p>
            <a href="http://127.0.0.1:8080" target="_blank" rel="noreferrer">
              Open resident app <ArrowUpRight size={14} />
            </a>
          </div>
          {session.user.platformAdmin && (
            <button
              className={`platform-link ${view === "communities" ? "selected" : ""}`}
              onClick={() => navigate("communities")}
            >
              <Building2 size={17} /> Manage societies{" "}
              <ChevronRight size={15} />
            </button>
          )}
          <button className="signout" onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
          <div className="local-status">
            <i />
            {health?.mode === "demo"
              ? "Local development"
              : "Connected workspace"}
            <span>v0.1</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <Menu size={21} />
          </button>
          <div className="society-icon">
            <Building2 size={22} />
          </div>
          <div className="community-select">
            <select
              aria-label="Select society"
              value={community}
              onChange={(e) => {
                setCommunity(e.target.value);
                setVisits([]);
              }}
            >
              {communities.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span>
              {selected?.city || "Your societies"} · Management office
            </span>
          </div>
          <div className="topbar-right">
            <span className="today">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              className="icon-button"
              aria-label="Refresh dashboard"
              onClick={() => {
                void refresh();
                void loadVisits();
              }}
            >
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
            <button
              className="icon-button bell"
              aria-label="View pending memberships"
              onClick={() => navigate("memberships")}
            >
              <Bell size={20} />
              {pending.length > 0 && <i />}
            </button>
            <div className="avatar">PM</div>
            <div className="header-name">
              <b>{session.user.name}</b>
              <span>Society administrator</span>
            </div>
          </div>
        </header>
        <main>
          <div className="breadcrumb">
            Your workspace <ChevronRight size={11} />{" "}
            {view === "communities"
              ? "Platform"
              : nav.find((n) => n.key === view)?.name}
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {!community && communities.length === 0 ? (
            <section className="panel">
              <Empty text="Create your first society to get started." />
              <button className="primary" onClick={() => setModal("community")}>
                <Plus size={16} />
                Create society
              </button>
            </section>
          ) : (
            <>
              {view === "overview" && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>A good day for your community.</h1>
                      <p>A little more organised. A lot more peace of mind.</p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => navigate("society")}
                    >
                      <Plus size={16} /> Manage homes
                    </button>
                  </div>
                  <div className="stats-grid">
                    {[
                      {
                        label: "Homes in your society",
                        value: overview?.stats.units,
                        sub: `Across ${overview?.stats.blocks || 0} towers`,
                        icon: Building2,
                        color: "peach",
                      },
                      {
                        label: "Visitors today",
                        value: overview?.stats.visits_today,
                        sub: "Every arrival, accounted for",
                        icon: Users,
                        color: "lavender",
                      },
                      {
                        label: "Currently inside",
                        value: overview?.stats.inside,
                        sub: "Visitors checked in",
                        icon: DoorOpen,
                        color: "sage",
                      },
                      {
                        label: "Pending requests",
                        value: pending.length,
                        sub: "A welcome waiting to happen",
                        icon: Clock3,
                        color: "sand",
                      },
                    ].map((s) => (
                      <section className="stat-card" key={s.label}>
                        <div className="stat-top">
                          <span>{s.label}</span>
                          <div className={`stat-icon ${s.color}`}>
                            <s.icon size={19} />
                          </div>
                        </div>
                        <strong>{s.value ?? "—"}</strong>
                        <p>{s.sub}</p>
                      </section>
                    ))}
                  </div>
                  <div className="overview-grid">
                    <section className="panel arrivals">
                      <div className="section-heading">
                        <div>
                          <h2>Coming & going</h2>
                          <p>Visitor arrivals over the last 7 days</p>
                        </div>
                        <span className="quiet-label">
                          <i />
                          Visitors
                        </span>
                      </div>
                      <div className="chart">
                        {(overview?.trend || []).map((d, i) => (
                          <div className="chart-column" key={i}>
                            <span>{d.count}</span>
                            <div
                              style={{
                                height: `${Math.max(4, (d.count / Math.max(1, ...(overview?.trend.map((t) => t.count) || []))) * 130)}px`,
                              }}
                              className={i === 6 ? "today-bar" : ""}
                            />
                            <label>{d.label}</label>
                          </div>
                        ))}
                      </div>
                      <div className="chart-note">
                        <ShieldCheck size={14} />
                        {overview?.stats.waiting || 0}{" "}
                        {overview?.stats.waiting === 1
                          ? "visitor is"
                          : "visitors are"}{" "}
                        waiting for resident approval.
                      </div>
                    </section>
                    <section className="panel join-card">
                      <div className="section-heading">
                        <h2>
                          New neighbours{" "}
                          <span className="count">{pending.length}</span>
                        </h2>
                        <button
                          className="text-button"
                          onClick={() => navigate("memberships")}
                        >
                          View all <ArrowRight size={14} />
                        </button>
                      </div>
                      <p className="subtext">Help someone feel at home.</p>
                      {pending.length ? (
                        pending.slice(0, 2).map((m) => (
                          <div className="membership-request" key={m.id}>
                            <div className="member-header">
                              <div className="avatar peach">
                                {m.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")}
                              </div>
                              <div>
                                <b>{m.name}</b>
                                <p>
                                  {m.unit} · {m.role}
                                </p>
                              </div>
                              <span className="request-tag">New</span>
                            </div>
                            <div className="request-actions">
                              <button
                                disabled={busy}
                                onClick={() => void decide(m, "rejected")}
                              >
                                Decline
                              </button>
                              <button
                                className="approve"
                                disabled={busy}
                                onClick={() => void decide(m, "approved")}
                              >
                                <Check size={14} /> Approve
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <Empty text="No membership requests waiting for you." />
                      )}
                    </section>
                  </div>
                  <section className="panel recent">
                    <div className="section-heading">
                      <div>
                        <h2>At the gate, and beyond</h2>
                        <p>The latest visitor activity in your society.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("visitors")}
                      >
                        All visitor logs <ArrowRight size={14} />
                      </button>
                    </div>
                    <VisitTable
                      entries={overview?.recent || []}
                      onSelect={setDetail}
                    />
                  </section>
                  <div className="bottom-note">
                    <ShieldCheck size={16} />
                    <span>
                      Every decision is recorded. Your community’s trust
                      matters.
                    </span>
                    {health?.push !== "enabled" && (
                      <b>Push delivery needs configuration</b>
                    )}
                  </div>
                </>
              )}
              {view === "society" && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>A home for every neighbour.</h1>
                      <p>
                        Organise your society into blocks, floors and flats.
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => setModal("block")}
                    >
                      <Plus size={16} /> Add block
                    </button>
                  </div>
                  <div className="block-tabs">
                    {structure.blocks.map((b) => (
                      <button
                        className={b.id === selectedBlock ? "active" : ""}
                        key={b.id}
                        onClick={() => setSelectedBlock(b.id)}
                      >
                        <Building2 size={19} />
                        Tower {b.name}
                        <span>
                          {
                            structure.units.filter((u) => u.block === b.name)
                              .length
                          }{" "}
                          homes
                        </span>
                      </button>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>
                        {structure.blocks.find((b) => b.id === selectedBlock)
                          ?.name
                          ? `Tower ${structure.blocks.find((b) => b.id === selectedBlock)?.name}`
                          : "Your society"}{" "}
                        · Floors & homes
                      </h2>
                      <div className="button-row">
                        <button
                          className="secondary"
                          disabled={!selectedBlock}
                          onClick={() => setModal("floor")}
                        >
                          <Plus size={14} /> Add floor
                        </button>
                        <button
                          className="primary"
                          disabled={!structure.floors.length}
                          onClick={() => setModal("unit")}
                        >
                          <Plus size={14} /> Add flat
                        </button>
                      </div>
                    </div>
                    {structure.floors
                      .filter((f) => f.block_id === selectedBlock)
                      .map((f) => (
                        <div className="floor-row" key={f.id}>
                          <div className="floor-label">
                            <b>{f.number}</b>
                            <span>FLOOR</span>
                          </div>
                          <div className="units">
                            {structure.units
                              .filter((u) => u.floor_id === f.id)
                              .map((u) => (
                                <div className="unit" key={u.id}>
                                  <Home size={18} />
                                  <b>{u.label}</b>
                                  <span>
                                    {members.some(
                                      (m) =>
                                        m.unit === u.label &&
                                        m.status === "approved",
                                    )
                                      ? "Occupied"
                                      : "Available"}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    {!structure.floors.some(
                      (f) => f.block_id === selectedBlock,
                    ) && (
                      <Empty text="Add a floor, then create the flats on it." />
                    )}
                  </section>
                </>
              )}
              {view === "memberships" && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>Good neighbours start here.</h1>
                      <p>
                        Review membership requests and know who calls your
                        society home.
                      </p>
                    </div>
                    <span className="summary-chip">
                      <Users size={16} />
                      {
                        members.filter(
                          (m) =>
                            ["owner", "tenant", "family"].includes(m.role) &&
                            m.status === "approved",
                        ).length
                      }{" "}
                      residents
                    </span>
                  </div>
                  <div className="filter-tabs">
                    {["pending", "approved", "rejected", "all"].map((s) => (
                      <button
                        className={memberFilter === s ? "active" : ""}
                        key={s}
                        onClick={() => setMemberFilter(s)}
                      >
                        {s === "all"
                          ? "Everyone"
                          : s === "pending"
                            ? "Pending requests"
                            : s[0].toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                  <section className="panel table-panel">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Resident</th>
                            <th>Home</th>
                            <th>Membership</th>
                            <th>Requested</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members
                            .filter(
                              (m) =>
                                memberFilter === "all" ||
                                m.status === memberFilter,
                            )
                            .map((m) => (
                              <tr key={m.id}>
                                <td>
                                  <div className="person-cell">
                                    <div className="avatar peach">
                                      {m.name[0]}
                                    </div>
                                    <div>
                                      <b>{m.name}</b>
                                      <small>{m.phone}</small>
                                    </div>
                                  </div>
                                </td>
                                <td>{m.unit || "Society team"}</td>
                                <td className="capitalize">{m.role}</td>
                                <td>{date(m.created_at)}</td>
                                <td>
                                  <Status value={m.status} />
                                </td>
                                <td>
                                  {m.status === "pending" ? (
                                    <div className="button-row">
                                      <button
                                        className="icon-button reject"
                                        aria-label={`Reject ${m.name}`}
                                        disabled={busy}
                                        onClick={() =>
                                          void decide(m, "rejected")
                                        }
                                      >
                                        <X size={17} />
                                      </button>
                                      <button
                                        className="small-approve"
                                        disabled={busy}
                                        onClick={() =>
                                          void decide(m, "approved")
                                        }
                                      >
                                        <Check size={14} />
                                        Approve
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="muted">Reviewed</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {!members.some(
                      (m) =>
                        memberFilter === "all" || m.status === memberFilter,
                    ) && (
                      <Empty text="There are no memberships with this status." />
                    )}
                  </section>
                </>
              )}
              {view === "visitors" && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>Every arrival tells a story.</h1>
                      <p>
                        Search, review and export your society’s visitor
                        history.
                      </p>
                    </div>
                    <button
                      className="secondary"
                      onClick={exportCsv}
                      disabled={!visits.length}
                    >
                      <Download size={15} /> Export loaded visits
                    </button>
                  </div>
                  <div className="filters">
                    <div className="search-box">
                      <Search size={18} />
                      <input
                        aria-label="Search visitors"
                        placeholder="Search visitor or company"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      aria-label="Filter visitor status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      {[
                        "pending",
                        "approved",
                        "denied",
                        "inside",
                        "exited",
                      ].map((s) => (
                        <option value={s} key={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <span>{visits.length} visits loaded</span>
                  </div>
                  <section className="panel table-panel">
                    <VisitTable entries={visits} onSelect={setDetail} />
                    {nextCursor && (
                      <div className="load-more">
                        <button
                          className="secondary"
                          onClick={() => void loadVisits(nextCursor)}
                        >
                          Load more visits
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}
              {view === "audit" && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>A clear record. A little reassurance.</h1>
                      <p>
                        Society changes and visitor decisions, recorded with who
                        and when.
                      </p>
                    </div>
                    <span className="summary-chip">
                      <ShieldCheck size={16} />
                      Append-only history
                    </span>
                  </div>
                  <section className="panel">
                    {audit.length ? (
                      audit.map((a) => (
                        <div className="audit-row" key={a.id}>
                          <div className="audit-icon">
                            <Activity size={17} />
                          </div>
                          <div>
                            <b>
                              {a.action
                                .replaceAll(".", " · ")
                                .replaceAll("_", " ")}
                            </b>
                            <p>{a.actor}</p>
                          </div>
                          <time>
                            {date(a.created_at)} · {time(a.created_at)}
                          </time>
                        </div>
                      ))
                    ) : (
                      <Empty text="New actions will appear here automatically." />
                    )}
                  </section>
                </>
              )}
              {view === "communities" && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>Room for more togetherness.</h1>
                      <p>
                        Create societies and open their management workspace.
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => setModal("community")}
                    >
                      <Plus size={16} /> Create society
                    </button>
                  </div>
                  <div className="society-cards">
                    {communities.map((c) => (
                      <button
                        className="panel society-card"
                        key={c.id}
                        onClick={() => {
                          setCommunity(c.id);
                          navigate("overview");
                        }}
                      >
                        <div className="society-icon">
                          <Building2 size={24} />
                        </div>
                        <h2>{c.name}</h2>
                        <p>
                          <MapPin size={14} />
                          {c.city}
                        </p>
                        <span>{c.address}</span>
                        <b>
                          Open workspace <ArrowRight size={16} />
                        </b>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {(["catalog", "services", "staff"] as string[]).includes(
                view,
              ) && (
                <CommunityAdmin
                  key={`${community}-${view}`}
                  token={session.token}
                  community={community}
                  mode={view as "catalog" | "services" | "staff"}
                />
              )}
            </>
          )}
        </main>
        <footer>
          <Home size={12} /> Made for a little more togetherness.
          <span>MyCommunity · Society management</span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close form"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            <div className="society-icon">
              <Building2 size={24} />
            </div>
            <h2 id="form-title">
              {modal === "community"
                ? "Welcome a new society"
                : `Add a ${modal === "unit" ? "flat" : modal}`}
            </h2>
            <p>A little structure makes everyday life simpler.</p>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={submit}>
              {modal === "community" ? (
                <>
                  <label>
                    Society name
                    <input
                      name="name"
                      placeholder="e.g. Palm Meadows"
                      minLength={2}
                      maxLength={100}
                      required
                      autoFocus
                    />
                  </label>
                  <label>
                    Address
                    <input
                      name="address"
                      placeholder="Street and area"
                      minLength={4}
                      maxLength={300}
                      required
                    />
                  </label>
                  <label>
                    City
                    <input
                      name="city"
                      placeholder="e.g. Bengaluru"
                      minLength={2}
                      maxLength={100}
                      required
                    />
                  </label>
                </>
              ) : modal === "block" ? (
                <label>
                  Block name
                  <input
                    name="name"
                    placeholder="e.g. E"
                    maxLength={30}
                    required
                    autoFocus
                  />
                </label>
              ) : modal === "floor" ? (
                <>
                  <label>
                    Block
                    <select
                      name="block_id"
                      defaultValue={selectedBlock}
                      required
                    >
                      {structure.blocks.map((b) => (
                        <option key={b.id} value={b.id}>
                          Tower {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Floor number
                    <input
                      name="number"
                      type="number"
                      min={-5}
                      max={200}
                      required
                      autoFocus
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Floor
                    <select name="floor_id" required>
                      {structure.floors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {
                            structure.blocks.find((b) => b.id === f.block_id)
                              ?.name
                          }{" "}
                          · Floor {f.number}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Flat label
                    <input
                      name="label"
                      placeholder="e.g. A-1206"
                      maxLength={40}
                      required
                      autoFocus
                    />
                  </label>
                  <label>
                    Home type
                    <select name="kind">
                      <option value="flat">Flat</option>
                      <option value="villa">Villa</option>
                    </select>
                  </label>
                </>
              )}
              <button className="primary wide" disabled={busy}>
                {busy ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Create{" "}
                {modal === "unit"
                  ? "flat"
                  : modal === "community"
                    ? "society"
                    : modal}
              </button>
            </form>
          </section>
        </div>
      )}
      {detail && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <section
            className="modal detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="visit-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close visitor details"
              onClick={() => setDetail(null)}
            >
              <X size={20} />
            </button>
            <VisitorIcon type={detail.type} />
            <h2 id="visit-title">{detail.name}</h2>
            <p>
              {detail.company || detail.type} · {detail.unit}
            </p>
            <Status value={detail.status} />
            <div className="detail-fields">
              <span>
                Mobile<b>+91 {detail.phone}</b>
              </span>
              <span>
                Purpose<b>{detail.purpose || detail.type}</b>
              </span>
              <span>
                People<b>{detail.people}</b>
              </span>
              {detail.vehicle && (
                <span>
                  Vehicle<b>{detail.vehicle}</b>
                </span>
              )}
            </div>
            <h3>Visit timeline</h3>
            {[
              ["Registered", detail.created_at],
              ["Approved", detail.approved_at],
              ["Denied", detail.denied_at],
              ["Checked in", detail.entered_at],
              ["Checked out", detail.exited_at],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div className="timeline-row" key={label}>
                  <CircleCheck size={17} />
                  <div>
                    <b>{label}</b>
                    <p>
                      {date(value!)} · {time(value!)}
                    </p>
                  </div>
                </div>
              ))}
          </section>
        </div>
      )}
    </div>
  );
}

function VisitTable({
  entries,
  onSelect,
}: {
  entries: Visit[];
  onSelect: (v: Visit) => void;
}) {
  return entries.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Visitor</th>
            <th>Visiting</th>
            <th>Category</th>
            <th>Time</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {entries.map((v) => (
            <tr
              key={v.id}
              onClick={() => onSelect(v)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(v);
              }}
              aria-label={`View ${v.name}`}
            >
              <td>
                <div className="person-cell">
                  <VisitorIcon type={v.type} />
                  <div>
                    <b>{v.name}</b>
                    <small>{v.company || "Personal visit"}</small>
                  </div>
                </div>
              </td>
              <td>
                <span className="unit-label">{v.unit}</span>
              </td>
              <td className="capitalize">{v.type}</td>
              <td>
                {time(v.created_at)}
                <small>{date(v.created_at)}</small>
              </td>
              <td>
                <Status value={v.status} />
              </td>
              <td>
                <ChevronRight size={15} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="No visits match your search." />
  );
}

function Login({
  onLogin,
}: {
  onLogin: (value: { token: string; user: User }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await request<{ access_token: string; user: User }>(
        "/auth/login",
        undefined,
        { method: "POST", body: JSON.stringify(values) },
      );
      onLogin({ token: result.access_token, user: result.user });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-story">
          <div className="brand">
            <Mark />
            <span>
              my<span>community</span>
            </span>
          </div>
          <span className="eyebrow">GOOD NEIGHBOURS. GREAT BEGINNINGS.</span>
          <h1>
            A happier place
            <br />
            to call home.
          </h1>
          <p>
            Thoughtful tools for the people who
            <br />
            make community living better.
          </p>
          <img
            src="/community.jpg"
            alt="A welcoming green residential community"
          />
          <span className="story-footer">
            <ShieldCheck size={17} />A little more organised. A lot more
            connected.
          </span>
        </div>
        <div className="login-form">
          <span className="eyebrow">YOUR COMMUNITY WORKSPACE</span>
          <h2>Welcome back.</h2>
          <p>A good day for your society starts here.</p>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                type="email"
                name="email"
                defaultValue="admin@mycommunity.local"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                defaultValue="Community@123"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="primary wide" disabled={busy}>
              {busy ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <>
                  Sign in to your community
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
          <div className="demo-note">
            <ShieldCheck size={18} />
            <div>
              <b>Local development workspace</b>
              <p>
                The sample administrator is filled in for you. Credentials apply
                only to the seeded local demo.
              </p>
            </div>
          </div>
          <a
            className="resident-link"
            href="http://127.0.0.1:8080"
            target="_blank"
            rel="noreferrer"
          >
            Looking for the resident app?
            <ArrowUpRight size={14} />
          </a>
        </div>
      </section>
    </main>
  );
}
