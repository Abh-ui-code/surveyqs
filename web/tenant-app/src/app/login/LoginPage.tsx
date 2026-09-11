"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/use-auth";
import { apiErrorMessage } from "@/lib/api-client/client";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  // Clear any stale credentials synchronously on mount, before the form
  // ever renders -- a leftover token from a previous session must never
  // race a fresh sign-in.
  useEffect(() => {
    window.localStorage.removeItem("surveyqs.access");
    window.localStorage.removeItem("surveyqs.refresh");
  }, []);

  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-strong lg:flex lg:flex-col lg:justify-between lg:p-12">
        <ContourField />
        <div className="relative z-10 flex items-center gap-2 text-brand-contrast">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/15 text-sm font-bold">S</span>
          <span className="text-sm font-semibold">SurveyQs</span>
        </div>
        <div className="relative z-10 max-w-sm">
          <p className="text-2xl font-medium leading-snug text-brand-contrast">
            Build a survey, send it to the field, and watch the data come in — from anywhere, even offline.
          </p>
          <p className="mt-4 text-sm text-brand-contrast/70">
            Every response is collected once, attributed to the agent who gathered it, and never leaves the field
            without a plan for getting back.
          </p>
        </div>
        <div className="relative z-10 text-xs text-brand-contrast/60">A multi-tenant field survey platform</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-contrast">
              S
            </span>
          </div>
          <h1 className="text-xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">Enter your workspace credentials to continue.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={handleSubmit((values) => login.mutate(values))}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" required>
                Email
              </Label>
              <Input id="email" type="email" autoComplete="username" error={!!errors.email} {...register("email")} />
              {errors.email && <p className="text-xs text-rust">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" required>
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-xs text-ink-faint hover:text-ink-muted"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                error={!!errors.password}
                {...register("password")}
              />
              {errors.password && <p className="text-xs text-rust">{errors.password.message}</p>}
            </div>

            {login.isError && (
              <p className="rounded-md bg-rust-soft px-3 py-2 text-sm text-rust">
                {apiErrorMessage(login.error, "Couldn't sign in. Check your email and password.")}
              </p>
            )}

            <Button type="submit" className="w-full" loading={login.isPending}>
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-ink-faint">
            Forgot your password?{" "}
            <a href="/forgot-password" className="text-brand hover:underline">
              Reset it
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/** A quiet field of contour lines -- the one deliberate visual moment on
 * this screen, tied to the product's own subject matter (surveying terrain)
 * rather than a decorative gradient. */
function ContourField() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <path
          key={i}
          d={`M -20 ${40 + i * 42} C 80 ${10 + i * 42}, 140 ${80 + i * 42}, 220 ${35 + i * 42} S 380 ${70 + i * 42}, 440 ${20 + i * 42}`}
          fill="none"
          stroke="white"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}
