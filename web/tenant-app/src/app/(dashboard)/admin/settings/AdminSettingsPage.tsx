"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DrawerField } from "@/components/ui/drawer-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGate } from "@/components/permission-gate";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useCategories } from "../../surveys/_hooks/use-surveys";
import { CreateCategoryDrawer } from "./_components/create-category-drawer";
import { useUpdateWorkspaceSettings, useWorkspaceSettings } from "../_hooks/use-admin";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

function WorkspaceTab() {
  const settingsQuery = useWorkspaceSettings();
  const update = useUpdateWorkspaceSettings();
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");

  useEffect(() => {
    if (settingsQuery.data?.settings.date_format) setDateFormat(settingsQuery.data.settings.date_format);
  }, [settingsQuery.data]);

  if (settingsQuery.isPending) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace preferences</CardTitle>
      </CardHeader>
      <CardContent className="max-w-sm space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">Workspace name</p>
          <p className="text-sm text-ink-muted">{settingsQuery.data?.name}</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">Address</p>
          <p className="font-mono-data text-sm text-ink-muted">{settingsQuery.data?.subdomain}.surveyqs.com</p>
        </div>
        <DrawerField label="Date format">
          <Select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </DrawerField>
      </CardContent>
      <CardFooter>
        <Button
          loading={update.isPending}
          onClick={() =>
            update.mutate(
              { date_format: dateFormat },
              {
                onSuccess: () => toast.success("Workspace preferences saved"),
                onError: (err) => toast.error("Couldn't save", { description: apiErrorMessage(err) }),
              },
            )
          }
        >
          Save
        </Button>
      </CardFooter>
    </Card>
  );
}

function CategoriesTab() {
  const categories = useCategories();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Survey categories</CardTitle>
        <CreateCategoryDrawer
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" /> New category
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {categories.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : !categories.data?.results.length ? (
          <EmptyState title="No categories yet" description="Categories are the topics surveys are grouped under." />
        ) : (
          <ul className="divide-y divide-line">
            {categories.data.results.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <span className="text-sm text-ink">{c.label}</span>
                <Badge tone="neutral">
                  {c.survey_count} survey{c.survey_count === 1 ? "" : "s"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsContent() {
  return (
    <div>
      <PageHeader title="Settings" description="Workspace preferences and survey categories." />
      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="workspace">
          <WorkspaceTab />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <PermissionGate module="settings" action="view" featureName="workspace settings">
      <SettingsContent />
    </PermissionGate>
  );
}
