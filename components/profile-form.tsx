"use client";

import { useAction } from "@/components/use-action";
import { Button } from "@/components/ui";
import { updateProfile } from "@/app/actions/account";

export function ProfileForm({ name }: { name: string }) {
  const { run, pending } = useAction();
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateProfile(String(new FormData(e.currentTarget).get("full_name"))));
      }}
    >
      <div className="flex-1">
        <label className="label" htmlFor="full_name">Full name</label>
        <input id="full_name" name="full_name" defaultValue={name} required className="input" />
      </div>
      <Button type="submit" disabled={pending}>Save</Button>
    </form>
  );
}
