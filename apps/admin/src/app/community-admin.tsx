"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, X, Check, RefreshCw } from "lucide-react";
import { request } from "@/lib/api";
type Item = {
  id: string;
  kind: string;
  title: string;
  author: string;
  category: string;
  price: number;
  status: string;
};
type ServiceRequest = {
  id: string;
  title: string;
  name: string;
  unit: string;
  scheduled_on: string;
  note: string;
  status: string;
};
export function CommunityAdmin({
  token,
  community,
  mode,
}: {
  token: string;
  community: string;
  mode: "catalog" | "services" | "staff";
}) {
  const [items, setItems] = useState<Item[]>([]),
    [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [kind, setKind] = useState("service"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState(false),
    [notice, setNotice] = useState("");
  const base = `/communities/${community}`;
  const load = useCallback(async () => {
    if (!community) return;
    try {
      if (mode === "services")
        setRequests(
          await request<ServiceRequest[]>(`${base}/service-requests`, token),
        );
      else if (mode === "catalog")
        setItems(
          (
            await request<{ items: Item[] }>(
              `${base}/items?kind=${kind}&limit=100`,
              token,
            )
          ).items,
        );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [base, token, kind, mode, community]);
  useEffect(() => {
    let current = true;
    setItems([]);
    setRequests([]);
    if (current) void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [load]);
  async function mutate(route: string, body: object) {
    setBusy(true);
    try {
      await request(`${base}/${route}`, token, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const data =
      mode === "staff"
        ? values
        : {
            ...values,
            kind,
            price: Number(values.price || 0),
            status: "published",
            image_asset: kind === "service" ? "cleaning" : "community",
          };
    if (await mutate(mode === "staff" ? "staff" : "items", data)) {
      setForm(false);
      setNotice(
        mode === "staff"
          ? "Staff member assigned. They can sign in with their verified phone number."
          : "Published to your community.",
      );
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {mode === "services"
              ? "A little help, well organised."
              : mode === "staff"
                ? "The people behind a safer community."
                : "Your community, in conversation."}
          </h1>
          <p>
            {mode === "services"
              ? "Review booking requests, confirm availability and record completion."
              : mode === "staff"
                ? "Assign guards or society administrators to verified phone numbers."
                : "Publish services and notices. Review society listings and posts."}
          </p>
        </div>
        <div className="button-row">
          <button
            className="secondary"
            aria-label="Refresh module"
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
          </button>
          {mode !== "services" && (
            <button
              className="primary"
              onClick={() => setForm(true)}
              disabled={
                mode === "catalog" && !["service", "notice"].includes(kind)
              }
            >
              <Plus size={16} />
              {mode === "staff" ? "Assign staff" : "Publish " + kind}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="bottom-note" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {mode === "catalog" && (
        <>
          <div className="filter-tabs">
            {["service", "notice", "post", "listing", "property"].map((k) => (
              <button
                key={k}
                className={kind === k ? "active" : ""}
                onClick={() => {
                  setKind(k);
                  setForm(false);
                }}
              >
                {k === "property"
                  ? "Homes"
                  : k === "listing"
                    ? "Buy & Sell"
                    : k[0].toUpperCase() + k.slice(1) + "s"}
              </button>
            ))}
          </div>
          <section className="panel table-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <b>{i.title}</b>
                      </td>
                      <td>{i.author}</td>
                      <td>{i.category}</td>
                      <td>₹{i.price.toLocaleString("en-IN")}</td>
                      <td>
                        <span
                          className={`status ${i.status === "published" ? "approved" : "pending"}`}
                        >
                          {i.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            void mutate(`items/${i.id}/status`, {
                              status:
                                i.status === "published"
                                  ? "closed"
                                  : "published",
                            })
                          }
                        >
                          {i.status === "published" ? "Close item" : "Publish"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length === 0 && (
              <div className="empty">
                <h3>No items yet</h3>
                <p>New items in this category will appear here.</p>
              </div>
            )}
          </section>
        </>
      )}
      {mode === "services" && (
        <section className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Resident</th>
                  <th>Preferred date</th>
                  <th>Requirements</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.title}</b>
                    </td>
                    <td>
                      {r.name}
                      <small>{r.unit}</small>
                    </td>
                    <td>{r.scheduled_on.slice(0, 10)}</td>
                    <td>{r.note}</td>
                    <td>
                      <span
                        className={`status ${r.status === "completed" ? "approved" : "pending"}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div className="button-row">
                        {r.status === "requested" && (
                          <button
                            className="small-approve"
                            disabled={busy}
                            onClick={() =>
                              void mutate(`service-requests/${r.id}/status`, {
                                status: "accepted",
                              })
                            }
                          >
                            Accept
                          </button>
                        )}
                        {r.status === "accepted" && (
                          <button
                            className="small-approve"
                            disabled={busy}
                            onClick={() =>
                              void mutate(`service-requests/${r.id}/status`, {
                                status: "completed",
                              })
                            }
                          >
                            Complete
                          </button>
                        )}
                        {["requested", "accepted"].includes(r.status) && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              void mutate(`service-requests/${r.id}/status`, {
                                status: "cancelled",
                              })
                            }
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {requests.length === 0 && (
            <div className="empty">
              <h3>No service requests</h3>
              <p>Requests submitted in the resident app will appear here.</p>
            </div>
          )}
        </section>
      )}
      {mode === "staff" && (
        <section className="panel">
          <h2>Phone-verified staff access</h2>
          <p className="subtext">
            Assign the mobile number your guard will use in the Flutter guard
            app. Only a platform administrator can appoint another society
            administrator. Existing assignments are visible under Residents →
            Everyone.
          </p>
          <button className="primary" onClick={() => setForm(true)}>
            <Plus size={16} />
            Assign staff
          </button>
        </section>
      )}
      {form && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="content-form-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close module form"
              disabled={busy}
              onClick={() => setForm(false)}
            >
              <X size={20} />
            </button>
            <h2 id="content-form-title">
              {mode === "staff" ? "Assign a staff member" : "Publish " + kind}
            </h2>
            <form onSubmit={submit}>
              {mode === "staff" ? (
                <>
                  <label>
                    Name
                    <input
                      name="name"
                      minLength={2}
                      maxLength={100}
                      required
                      autoFocus
                    />
                  </label>
                  <label>
                    Mobile number
                    <input
                      name="phone"
                      inputMode="numeric"
                      pattern="[6-9][0-9]{9}"
                      maxLength={10}
                      required
                      placeholder="10-digit Indian mobile"
                    />
                  </label>
                  <label>
                    Role
                    <select name="role">
                      <option value="guard">Security guard</option>
                      <option value="admin">Society administrator</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Title
                    <input
                      name="title"
                      minLength={3}
                      maxLength={120}
                      required
                      autoFocus
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      name="description"
                      maxLength={3000}
                      rows={5}
                      required
                      style={{
                        width: "100%",
                        padding: 12,
                        border: "1px solid #ddd",
                        borderRadius: 10,
                        font: "inherit",
                      }}
                    />
                  </label>
                  <label>
                    Category
                    <input
                      name="category"
                      maxLength={60}
                      required
                      defaultValue={
                        kind === "service" ? "Cleaning" : "Community"
                      }
                    />
                  </label>
                  {kind === "service" && (
                    <label>
                      Starting price in rupees
                      <input
                        name="price"
                        type="number"
                        min={0}
                        max={2000000000}
                        required
                      />
                    </label>
                  )}
                </>
              )}
              {error && <div className="form-error">{error}</div>}
              <button className="primary wide" disabled={busy}>
                {busy
                  ? "Saving…"
                  : mode === "staff"
                    ? "Assign staff"
                    : "Publish"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
