"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function LogoIcon({ size = 32 }) {
  const r = Math.round(size * 0.25);
  const s = Math.round(size * 0.56);
  return (
    <div style={{
      width: size, height: size, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
    }}>
      <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
        <rect x="1"  y="11" width="3" height="6"  rx="1" fill="white" fillOpacity="0.65"/>
        <rect x="6"  y="7"  width="3" height="10" rx="1" fill="white" fillOpacity="0.85"/>
        <rect x="11" y="3"  width="3" height="14" rx="1" fill="white"/>
        <path d="M2.5 10.5 C5.5 6 9 6.5 12.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        <path d="M10.5 1.5 L13 2.5 L12 5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    // Auto sign-in after successful signup
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      router.push("/login");
    } else {
      router.push("/");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f8f7ff 0%, #ede9fe 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 32 }}>
        <LogoIcon size={36} />
        <span style={{
          fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em",
          background: "linear-gradient(135deg, #1a1a2e 0%, #6c5ce7 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
          StatementFlow
        </span>
      </Link>

      {/* Card */}
      <div style={{
        background: "white",
        borderRadius: 20,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 4px 40px rgba(108,92,231,0.12)",
        border: "1px solid rgba(108,92,231,0.1)",
      }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1a1a2e", marginBottom: 6, textAlign: "center" }}>
          Create your account
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#64748b", textAlign: "center", marginBottom: 28 }}>
          Free plan includes 3 uploads per month
        </p>

        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
            padding: "12px 14px", marginBottom: 20, color: "#dc2626", fontSize: "0.875rem",
          }}>
            {error}
          </div>
        )}

        {/* Google button */}
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/account" })}
          style={{
            width: "100%", padding: "12px", border: "1px solid #e2e8f0",
            borderRadius: 10, background: "white", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10, marginBottom: 20, fontSize: "0.95rem", fontWeight: 500,
            color: "#374151", transition: "border-color 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6c5ce7")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500 }}>or</span>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Name <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: "0.95rem",
                border: "1.5px solid #e2e8f0", outline: "none", boxSizing: "border-box",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#6c5ce7")}
              onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: "0.95rem",
                border: "1.5px solid #e2e8f0", outline: "none", boxSizing: "border-box",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#6c5ce7")}
              onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Min. 8 characters"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: "0.95rem",
                border: "1.5px solid #e2e8f0", outline: "none", boxSizing: "border-box",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#6c5ce7")}
              onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              background: loading ? "#a5b4fc" : "linear-gradient(135deg, #6d28d9, #4f46e5)",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "13px",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "filter 0.2s ease",
            }}
          >
            {loading ? "Creating account…" : "Create free account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.875rem", color: "#64748b" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#6c5ce7", fontWeight: 600, textDecoration: "none" }}>
            Log in
          </Link>
        </p>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.75rem", color: "#94a3b8" }}>
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
