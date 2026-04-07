import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { addBan, AdminUser, markReportStatus, queueNotification, readAdminStore } from "@/lib/adminStore";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_PIN = "9562770397";

const SuperAdmin = () => {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [mode, setMode] = useState<"email" | "push" | "both">("both");
  const [authUsers, setAuthUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const store = useMemo(() => readAdminStore(), [refreshSeed]);

  useEffect(() => {
    if (!isUnlocked) return;
    const id = window.setInterval(() => setRefreshSeed((n) => n + 1), 2000);
    return () => window.clearInterval(id);
  }, [isUnlocked]);

  useEffect(() => {
    if (!isUnlocked) return;
    const loadAuthUsers = async () => {
      setLoadingUsers(true);
      const { data, error } = await supabase.functions.invoke("admin-list-users", {
        body: { pin: ADMIN_PIN },
      });
      setLoadingUsers(false);

      if (error) {
        toast.error("Unable to load Supabase auth users. Please deploy admin-list-users edge function.");
        return;
      }

      const users = Array.isArray(data?.users) ? (data.users as AdminUser[]) : [];
      setAuthUsers(users);
    };
    loadAuthUsers();
  }, [isUnlocked, refreshSeed]);

  const tryUnlock = (e: FormEvent) => {
    e.preventDefault();
    if (pin !== ADMIN_PIN) {
      toast.error("Invalid admin pincode");
      return;
    }
    setIsUnlocked(true);
    toast.success("Admin unlocked");
  };

  const handleSendNotification = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEmails.length) {
      toast.error("Select at least one authenticated user");
      return;
    }
    if (!messageTitle.trim() || !messageBody.trim()) {
      toast.error("Title and message are required");
      return;
    }

    queueNotification({
      type: mode,
      title: messageTitle.trim(),
      body: messageBody.trim(),
      recipients: selectedEmails,
    });

    let invokeFailed = false;
    for (const email of selectedEmails) {
      try {
        if (mode === "email" || mode === "both") {
          await supabase.functions.invoke("send-user-email-notification", {
            body: { email, title: messageTitle.trim(), body: messageBody.trim() },
          });
        }
        if (mode === "push" || mode === "both") {
          await supabase.functions.invoke("send-user-push-notification", {
            body: { email, title: messageTitle.trim(), body: messageBody.trim() },
          });
        }
      } catch {
        invokeFailed = true;
      }
    }

    toast.success("Notification queued");
    if (invokeFailed) {
      toast.warning("Some function calls failed. Deploy the notification edge functions to send live email/push.");
    }
    setMessageTitle("");
    setMessageBody("");
    setRefreshSeed((n) => n + 1);
  };

  const banDurations = [
    { label: "10 sec", value: 10 },
    { label: "1 minute", value: 60 },
    { label: "10 minute", value: 600 },
  ];

  if (!isUnlocked) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4">
        <form onSubmit={tryUnlock} className="w-full max-w-md border border-border rounded-2xl p-6 space-y-4 bg-card">
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Enter pincode to access moderation and notifications.</p>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            type="password"
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3"
            placeholder="Admin pincode"
          />
          <button className="w-full rounded-xl bg-accent text-accent-foreground px-4 py-3 font-semibold">
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Super Admin Panel</h1>

      <section className="border border-border rounded-2xl p-4 bg-card space-y-3">
        <h2 className="text-lg font-semibold">Authenticated Users ({authUsers.length})</h2>
        <div className="max-h-64 overflow-auto space-y-2">
          {authUsers.map((user) => (
            <label key={user.email} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div>
                <p className="font-medium">{user.nickname || user.email}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <input
                type="checkbox"
                checked={selectedEmails.includes(user.email)}
                onChange={(e) => {
                  setSelectedEmails((prev) =>
                    e.target.checked ? [...prev, user.email] : prev.filter((mail) => mail !== user.email)
                  );
                }}
              />
            </label>
          ))}
          {!loadingUsers && !authUsers.length && <p className="text-sm text-muted-foreground">No users available yet.</p>}
          {loadingUsers && <p className="text-sm text-muted-foreground">Loading users from Supabase...</p>}
        </div>
      </section>

      <section className="border border-border rounded-2xl p-4 bg-card space-y-3">
        <h2 className="text-lg font-semibold">Send Notification (Manual)</h2>
        <form onSubmit={handleSendNotification} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-2">
            {(["email", "push", "both"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-xl border px-3 py-2 text-sm ${mode === item ? "bg-accent text-accent-foreground" : "bg-secondary border-border"}`}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            value={messageTitle}
            onChange={(e) => setMessageTitle(e.target.value)}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3"
            placeholder="Notification title"
          />
          <textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 min-h-24"
            placeholder="Notification body"
          />
          <button className="rounded-xl bg-accent text-accent-foreground px-4 py-3 font-semibold">
            Send to Selected Users
          </button>
        </form>
      </section>

      <section className="border border-border rounded-2xl p-4 bg-card space-y-3">
        <h2 className="text-lg font-semibold">Reports & Manual Ban</h2>
        <div className="space-y-2 max-h-80 overflow-auto">
          {store.reports.map((report) => (
            <div key={report.id} className="rounded-xl border border-border p-3 space-y-2">
              <p className="text-sm"><span className="font-semibold">{report.reporterNickname}</span> reported <span className="font-semibold">{report.reportedNickname || "Unknown user"}</span></p>
              <p className="text-xs text-muted-foreground">Reason: {report.reason}</p>
              <p className="text-xs text-muted-foreground">Status: {report.status}</p>
              <div className="flex flex-wrap gap-2">
                {banDurations.map((duration) => (
                  <button
                    key={duration.value}
                    onClick={() => {
                      const matched = authUsers.find((u) => u.nickname === report.reportedNickname);
                      if (!matched?.email) {
                        toast.error("Reported user email not available for manual ban");
                        return;
                      }
                      addBan(matched.email, duration.value, report.reason);
                      markReportStatus(report.id, "banned");
                      toast.success(`User banned for ${duration.label}`);
                      setRefreshSeed((n) => n + 1);
                    }}
                    className="text-xs rounded-lg px-2 py-1 bg-destructive text-destructive-foreground"
                  >
                    Ban {duration.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    markReportStatus(report.id, "ignored");
                    setRefreshSeed((n) => n + 1);
                  }}
                  className="text-xs rounded-lg px-2 py-1 bg-secondary"
                >
                  Ignore
                </button>
              </div>
            </div>
          ))}
          {!store.reports.length && <p className="text-sm text-muted-foreground">No reports yet.</p>}
        </div>
      </section>
    </div>
  );
};

export default SuperAdmin;
