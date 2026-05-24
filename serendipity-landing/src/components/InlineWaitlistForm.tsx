import { useMemo, useState } from "react";

type SubmitStatus = "idle" | "loading" | "success" | "already-added" | "error";

interface InlineWaitlistFormProps {
  className?: string;
  align?: "left" | "center";
  caption?: string;
  platform?: string;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function InlineWaitlistForm({
  className = "",
  align = "center",
  caption = "Get early access before Toronto Tech Week.",
  platform = "web",
}: InlineWaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const isJoined = status === "success" || status === "already-added";
  const isLoading = status === "loading";

  const noteToneClass = useMemo(() => {
    if (status === "error") {
      return "text-[var(--color-conflict)]";
    }
    if (isJoined) {
      return "text-[var(--color-connection)]";
    }
    return "text-[var(--color-text-muted)]";
  }, [isJoined, status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setStatus("error");
      setMessage("Use a valid email address.");
      return;
    }

    try {
      setStatus("loading");
      setMessage(null);

      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          platform,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join the waitlist.");
      }

      if (data.alreadyAdded) {
        setStatus("already-added");
        setMessage("You are already on the waitlist.");
        return;
      }

      setStatus("success");
      setMessage("You are on the waitlist.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "There was an issue processing your request. Please try again."
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`w-full max-w-xl ${className}`} aria-label="Serendipity waitlist form">
      <div className="flex items-center gap-3 rounded-full border border-white/12 bg-[var(--color-surface-900)]/55 py-[6px] pl-5 pr-[8px] backdrop-blur-sm">
        <input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status === "error") {
              setStatus("idle");
              setMessage(null);
            }
          }}
          className="h-10 min-w-0 flex-1 appearance-none border-0 bg-transparent px-0 text-base leading-none text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]/75"
          disabled={isLoading || isJoined}
          aria-invalid={status === "error"}
        />
        <button
          type="submit"
          disabled={isLoading || isJoined}
          className="h-10 min-w-[8.1rem] shrink-0 rounded-full bg-[var(--color-accent-400)] px-5 text-sm font-semibold leading-none text-[var(--color-surface-950)] transition-colors duration-200 hover:bg-[var(--color-accent-500)] disabled:cursor-default disabled:opacity-100"
        >
          {isJoined ? "Joined" : isLoading ? "Joining..." : "Join waitlist"}
        </button>
      </div>

      {(message || caption) && (
        <p className={`mt-3 text-sm ${align === "center" ? "text-center" : "text-left"} ${noteToneClass}`}>
          {message ?? caption}
        </p>
      )}
    </form>
  );
}
