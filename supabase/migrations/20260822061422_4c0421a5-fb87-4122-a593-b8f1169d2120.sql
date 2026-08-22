alter table public.attendance
  add constraint attendance_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.leave_requests
  add constraint leave_requests_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.salary_structures
  add constraint salary_structures_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;