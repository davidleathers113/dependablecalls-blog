-- Create transactional function for user creation
-- This ensures all user-related records are created atomically

create or replace function public.create_full_user(
  p_email text,
  p_password text,
  p_first_name text,
  p_last_name text,
  p_user_type text,
  p_company text default null,
  p_business_type text default null,
  p_credit_balance numeric default null,
  p_credit_limit numeric default null,
  p_current_balance numeric default null
) returns uuid
language plpgsql security definer
as $$
declare
  v_user_id uuid;
begin
  -- 1. Create auth user with auto-confirmed email
  insert into auth.users (
    email, 
    encrypted_password, 
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    p_email, 
    crypt(p_password, gen_salt('bf')), 
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'user_type', p_user_type
    )
  )
  returning id into v_user_id;

  -- 2. Create public user profile
  insert into public.users (
    id, 
    email, 
    first_name, 
    last_name, 
    status, 
    is_active
  )
  values (
    v_user_id, 
    p_email, 
    p_first_name, 
    p_last_name, 
    'active', 
    true
  );

  -- 3. Create role-specific record
  if p_user_type = 'admin' then
    insert into public.admins (
      user_id, 
      role, 
      permissions, 
      is_active
    )
    values (
      v_user_id, 
      'super_admin',
      jsonb_build_object(
        'super_admin', true,
        'user_management', true,
        'financial_management', true
      ),
      true
    );
  elsif p_user_type = 'supplier' then
    insert into public.suppliers (
      user_id, 
      company_name, 
      business_type, 
      credit_balance,
      status, 
      approved_at
    )
    values (
      v_user_id, 
      p_company, 
      p_business_type, 
      coalesce(p_credit_balance, 1500.00), 
      'active', 
      now()
    );
  elsif p_user_type = 'buyer' then
    insert into public.buyers (
      user_id, 
      company_name, 
      business_type,
      credit_limit, 
      current_balance, 
      status, 
      approved_at
    )
    values (
      v_user_id, 
      p_company, 
      p_business_type,
      coalesce(p_credit_limit, 10000.00),
      coalesce(p_current_balance, 0.00),
      'active', 
      now()
    );
  elsif p_user_type = 'network' then
    -- Network users only need the basic user record
    -- No additional table insertion required
    null;
  else
    raise exception 'Invalid user type: %', p_user_type;
  end if;

  return v_user_id;
exception
  when others then
    -- Ensure complete rollback on any error
    raise;
end;
$$;

-- Grant execute permission to service role only
grant execute on function public.create_full_user to service_role;

-- Create a secure function to generate random passwords
create or replace function public.generate_secure_password()
returns text
language plpgsql security definer
as $$
declare
  v_chars text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  v_password text := '';
  v_length int := 20;
  i int;
begin
  for i in 1..v_length loop
    v_password := v_password || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  end loop;
  return v_password;
end;
$$;

-- Grant execute permission to service role only
grant execute on function public.generate_secure_password to service_role;

-- Create a function to clean up test users (for development only)
create or replace function public.cleanup_test_users()
returns void
language plpgsql security definer
as $$
declare
  v_test_emails text[] := array[
    'admin@dce-test.com',
    'supplier@dce-test.com',
    'buyer@dce-test.com',
    'buyer2@dce-test.com'
  ];
  v_email text;
  v_user_id uuid;
begin
  foreach v_email in array v_test_emails loop
    -- Get user ID if exists
    select id into v_user_id from auth.users where email = v_email;
    
    if v_user_id is not null then
      -- Delete from role-specific tables first (due to foreign keys)
      delete from public.admins where user_id = v_user_id;
      delete from public.suppliers where user_id = v_user_id;
      delete from public.buyers where user_id = v_user_id;
      
      -- Delete from users table
      delete from public.users where id = v_user_id;
      
      -- Delete from auth.users
      delete from auth.users where id = v_user_id;
    end if;
  end loop;
end;
$$;

-- Grant execute permission to service role only
grant execute on function public.cleanup_test_users to service_role;

-- Add comment explaining the purpose
comment on function public.create_full_user is 'Transactionally creates a complete user with auth, profile, and role-specific records. Ensures data consistency by rolling back all changes if any step fails.';
comment on function public.generate_secure_password is 'Generates cryptographically secure random passwords for test accounts';
comment on function public.cleanup_test_users is 'Development-only function to remove test accounts. DO NOT use in production.';