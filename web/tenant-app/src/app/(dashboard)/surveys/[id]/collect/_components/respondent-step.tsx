"use client";

import { Check, Plus, User, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client/client";
import { cn } from "@/lib/utils";
import { useCreateRespondent, useSearchRespondents, type Respondent } from "../_hooks/use-collect";

export function RespondentStep({
  selected,
  onSelect,
}: {
  selected: Respondent | null;
  onSelect: (respondent: Respondent) => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", gender: "", address: "" });
  const search = useSearchRespondents(query);
  const createRespondent = useCreateRespondent();

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault();
    createRespondent.mutate(
      {
        full_name: form.full_name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        gender: form.gender || undefined,
        address: form.address || undefined,
      },
      {
        onSuccess: (respondent) => {
          onSelect(respondent);
          setCreating(false);
          toast.success(`${respondent.full_name} added`);
        },
        onError: (err) => toast.error("Couldn't add respondent", { description: apiErrorMessage(err) }),
      },
    );
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-brand/30 bg-brand-soft px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-contrast">
            <User className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">{selected.full_name}</p>
            <p className="text-xs text-ink-muted">{selected.phone || selected.email || "No contact info"}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null as unknown as Respondent)}>
          Change
        </Button>
      </div>
    );
  }

  if (creating) {
    return (
      <form onSubmit={submitNew} className="space-y-3 rounded-md border border-line p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-ink">New respondent</h4>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
        <DrawerField label="Full name" required>
          <Input
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Jane Farmer"
            required
          />
        </DrawerField>
        <div className="grid grid-cols-2 gap-3">
          <DrawerField label="Phone">
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </DrawerField>
          <DrawerField label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </DrawerField>
        </div>
        <DrawerField label="Gender">
          <Select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </Select>
        </DrawerField>
        <DrawerField label="Address">
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </DrawerField>
        <Button type="submit" className="w-full" loading={createRespondent.isPending}>
          <Plus className="h-4 w-4" /> Add respondent
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Search by name, phone or ID..." />

      {query.trim().length < 2 ? (
        <p className="px-1 py-6 text-center text-sm text-ink-faint">Type at least 2 characters to search.</p>
      ) : search.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : search.data && search.data.results.length > 0 ? (
        <ul className="space-y-1.5">
          {search.data.results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border border-line px-3 py-2.5 text-left hover:bg-paper-sunken",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-ink">{r.full_name}</p>
                  <p className="text-xs text-ink-muted">{r.phone || r.email || "No contact info"}</p>
                </div>
                <Check className="h-4 w-4 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-6 text-center text-sm text-ink-faint">No matches for &ldquo;{query}&rdquo;.</p>
      )}

      <Button type="button" variant="secondary" className="w-full" onClick={() => setCreating(true)}>
        <UserPlus className="h-4 w-4" /> Add a new respondent
      </Button>
    </div>
  );
}
