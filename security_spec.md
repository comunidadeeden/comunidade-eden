# Security Specification - Eden Area de Membros

## Data Invariants
1. Students can only receive limited client-side point deltas used by the current app flows: lesson completion (+7/-7), daily audio (+5), and mission completion (+30).
2. Only Admins can modify trails, modules, and contents.
3. Students can only update their own profile fields: profession, instagram, name, and avatar. Role and email are immutable for students.
4. Global settings can only be managed by Admins.
5. Content read access is public for authenticated users.

## The "Dirty Dozen" Payloads (Attacks)
1. **Identitiy Spoofing**: Student tries to change their `role` to `admin`.
2. **Point Injection**: Student tries to increment their `points` outside the allowed app deltas.
3. **Privilege Escalation**: Non-authenticated user tries to read `users` collection.
4. **Data Deletion**: Student tries to delete a `module`.
5. **Shadow Field injection**: User tries to add `isVerified: true` to their profile.
6. **Relational Overwrite**: User tries to change `moduleIds` in a `trail`.
7. **Bypassing Verification**: Setting `emailVerified: true` manually (not possible via rules directly but checking intent).
8. **Setting another user's email**: Student changing `email` to another user's email.
9. **Global Config Tampering**: Student tries to set `tabVisibility.gameficacao: true`.
10. **Resource Exhaustion**: Sending 1MB string as `name`.
11. **ID Poisoning**: Creating a content with a malicious ID like `../system`.
12. **Status Skipping**: If there was a status, but here it's more about state.

## The Test Runner (Plan)
We will verify that `PERMISSION_DENIED` is returned for all non-owner writes to sensitive fields and all non-admin writes to structural data.
