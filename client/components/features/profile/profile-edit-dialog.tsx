import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, type Profile } from "@/lib/dayflow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileEditDialog({
  profile,
  canEditAll,
  trigger,
}: {
  profile: Profile;
  canEditAll: boolean;
  trigger: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: profile.full_name,
    employee_id: profile.employee_id,
    department: profile.department ?? "",
    designation: profile.designation ?? "",
    date_of_joining: profile.date_of_joining ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        full_name: profile.full_name,
        employee_id: profile.employee_id,
        department: profile.department ?? "",
        designation: profile.designation ?? "",
        date_of_joining: profile.date_of_joining ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
      });
    }
  }, [open, profile]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = canEditAll
        ? { ...form, updated_at: new Date().toISOString() }
        : {
            phone: form.phone,
            address: form.address,
            updated_at: new Date().toISOString(),
          };
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profile", profile.id] });
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Edit profile</DialogTitle>
          <DialogDescription>
            {canEditAll
              ? "HR can edit every field of this profile."
              : "You can update your contact details. Job details are managed by HR."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input
              value={form.full_name}
              onChange={set("full_name")}
              disabled={!canEditAll}
              className="rounded-xl bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Employee ID</Label>
            <Input
              value={form.employee_id}
              onChange={set("employee_id")}
              disabled={!canEditAll}
              className="rounded-xl bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Input
              value={form.department}
              onChange={set("department")}
              disabled={!canEditAll}
              className="rounded-xl bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Designation</Label>
            <Input
              value={form.designation}
              onChange={set("designation")}
              disabled={!canEditAll}
              className="rounded-xl bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date of joining</Label>
            <Input
              type="date"
              value={form.date_of_joining}
              onChange={set("date_of_joining")}
              disabled={!canEditAll}
              className="rounded-xl bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={set("phone")}
              placeholder="+91 …"
              className="rounded-xl bg-card"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={set("address")}
              placeholder="City, State"
              className="rounded-xl bg-card"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-xl"
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
