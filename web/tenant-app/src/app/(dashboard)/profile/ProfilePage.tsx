"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/providers/theme-provider";
import { useChangePassword, useMe, useUpdateProfile } from "@/hooks/use-auth";
import { apiErrorMessage } from "@/lib/api-client/client";
import { cn } from "@/lib/utils";

const profileSchema = z.object({ full_name: z.string().min(1, "Enter your name.") });
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    new_password: z.string().min(8, "Use at least 8 characters."),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "Passwords don't match.",
    path: ["confirm_password"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function ProfileSection() {
  const me = useMe();
  const updateProfile = useUpdateProfile();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (me.data) reset({ full_name: me.data.full_name });
  }, [me.data, reset]);

  if (me.isPending) return <Skeleton className="h-56 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <form
        onSubmit={handleSubmit((values) =>
          updateProfile.mutate(values.full_name, {
            onSuccess: () => toast.success("Profile updated"),
            onError: (err) => toast.error("Couldn't update profile", { description: apiErrorMessage(err) }),
          }),
        )}
      >
        <CardContent className="max-w-sm space-y-4">
          <DrawerField label="Full name" required error={errors.full_name?.message}>
            <Input {...register("full_name")} />
          </DrawerField>
          <DrawerField label="Email" hint="Contact an administrator to change your sign-in email.">
            <Input value={me.data?.email} disabled />
          </DrawerField>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isDirty} loading={updateProfile.isPending}>
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function SecuritySection() {
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = (values: PasswordValues) => {
    changePassword.mutate(
      { current_password: values.current_password, new_password: values.new_password },
      {
        onSuccess: () => {
          toast.success("Password changed");
          reset();
        },
        onError: (err) => toast.error("Couldn't change password", { description: apiErrorMessage(err) }),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="max-w-sm space-y-4">
          <DrawerField label="Current password" required error={errors.current_password?.message}>
            <Input type="password" autoComplete="current-password" {...register("current_password")} />
          </DrawerField>
          <DrawerField label="New password" required error={errors.new_password?.message}>
            <Input type="password" autoComplete="new-password" {...register("new_password")} />
          </DrawerField>
          <DrawerField label="Confirm new password" required error={errors.confirm_password?.message}>
            <Input type="password" autoComplete="new-password" {...register("confirm_password")} />
          </DrawerField>
        </CardContent>
        <CardFooter>
          <Button type="submit" loading={changePassword.isPending}>
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const THEME_OPTIONS = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

function AppearanceSection() {
  const { mode, setMode } = useTheme();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid max-w-sm grid-cols-3 gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-md border px-3 py-3 text-sm transition-colors",
                mode === opt.value ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-ink-muted hover:bg-paper-sunken",
              )}
            >
              {mode === opt.value && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-brand" />}
              <opt.icon className="h-5 w-5" />
              {opt.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="My profile" description="Your account, your password, and how SurveyQs looks for you." />
      <div className="grid max-w-2xl grid-cols-1 gap-4">
        <ProfileSection />
        <SecuritySection />
        <AppearanceSection />
      </div>
    </div>
  );
}
