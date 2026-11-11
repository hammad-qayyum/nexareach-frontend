"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api/client";
import { canEdit, useCurrentUser } from "@/lib/session";
import { CampaignForm, type CampaignValues } from "../campaign-form";

export function NewCampaign() {
  const me = useCurrentUser();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const groupId = Number(params.get("group")) || null;

  const create = useMutation({
    mutationFn: (values: CampaignValues) => unwrap(api.POST("/api/campaigns", { body: values })),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      router.push(`/campaigns/${c.id}`);
    },
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/campaigns">
            <ArrowLeftIcon data-icon="inline-start" /> Campaigns
          </Link>
        </Button>
        <PageHeader
          title="New campaign"
          description="It's saved as a draft. Nothing is sent until you send a test and press Start."
        />
      </div>
      {canEdit(me.role) ? (
        <CampaignForm
          // A fresh form for each visit, even when the page is restored from the back stack.
          key={params.toString()}
          initialGroupId={groupId}
          submitLabel="Save draft"
          pending={create.isPending}
          error={create.error?.message}
          onSubmit={(values) => create.mutate(values)}
        />
      ) : (
        <Forbidden title="View only" description="Viewers can see everything but can't make changes." />
      )}
    </div>
  );
}
