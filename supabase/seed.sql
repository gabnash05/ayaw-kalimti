insert into auth.users (
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'fixture-a@example.invalid',
    '{}',
    '{}',
    '2000-01-01 00:00:00+00',
    '2000-01-01 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'fixture-b@example.invalid',
    '{}',
    '{}',
    '2000-01-01 00:00:00+00',
    '2000-01-01 00:00:00+00'
  )
on conflict (id) do nothing;
