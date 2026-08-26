import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, type Profile } from "@/lib/dayflow";
import { InitialsAvatar } from "@/components/common/bits";
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

/** Center-crop and resize an image file to a 256px square WebP blob. */
async function fileToAvatarBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process image."))),
      "image/webp",
      0.85,
    ),
  );
}

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
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
      setPhotoFile(null);
      setPhotoPreview(null);
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
      let avatar_url: string | undefined;
      if (photoFile) {
        const blob = await fileToAvatarBlob(photoFile);
        const path = `${profile.id}/avatar-${Date.now()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { contentType: "image/webp", upsert: true });
        if (uploadError) throw uploadError;
        avatar_url = path;
      }
      const finalAvatarUrl = avatar_url ?? profile.avatar_url ?? null;
      const payload = canEditAll
        ? {
            id: profile.id,
            employee_id: form.employee_id,
            full_name: form.full_name,
            department: form.department || null,
            designation: form.designation || null,
            date_of_joining: form.date_of_joining || null,
            phone: form.phone || null,
            address: form.address || null,
            avatar_url: finalAvatarUrl,
            updated_at: new Date().toISOString(),
          }
        : {
            id: profile.id,
            employee_id: profile.employee_id,
            full_name: profile.full_name,
            department: profile.department,
            designation: profile.designation,
            date_of_joining: profile.date_of_joining,
            phone: form.phone || null,
            address: form.address || null,
            avatar_url: finalAvatarUrl,
            updated_at: new Date().toISOString(),
          };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profile", profile.id] });
      queryClient.invalidateQueries({ queryKey: ["avatar-url"] });
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
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4">
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="New profile photo preview"
              className="size-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <InitialsAvatar
              name={profile.full_name}
              src={profile.avatar_url}
              className="size-16 text-lg"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Profile photo</p>
            <p className="text-xs text-muted-foreground">
              Square images look best. Resized to 256px automatically.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (photoPreview) URL.revokeObjectURL(photoPreview);
              setPhotoFile(file);
              setPhotoPreview(URL.createObjectURL(file));
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="size-4" />
            Choose
          </Button>
        </div>
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
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl">
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
