'use server';

import { redirect } from 'next/navigation';

import { createOwnerBusinessForUser, updateBusinessOnboarding } from '@/lib/auth/business';
import { requireSession } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function loginAction(formData: FormData) {
  const email = getString(formData, 'email');
  const password = getString(formData, 'password');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}

export async function signupAction(formData: FormData) {
  const email = getString(formData, 'email');
  const password = getString(formData, 'password');
  const fullName = getString(formData, 'fullName');
  const businessName = getString(formData, 'businessName') || 'My Business';

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        business_name: businessName,
      },
    },
  });

  if (error || !data.user) {
    redirect(`/signup?error=${encodeURIComponent(error?.message ?? 'Unable to create your account.')}`);
  }

  try {
    await createOwnerBusinessForUser({
      user: data.user,
      businessName,
      fullName,
    });
  } catch (error) {
    console.error('Workspace provisioning failed during signup.', error);

    const createdNewAuthUser = (data.user.identities?.length ?? 0) > 0;

    if (createdNewAuthUser) {
      try {
        await getSupabaseAdminClient().auth.admin.deleteUser(data.user.id);
      } catch (cleanupError) {
        console.error('Failed to clean up Supabase auth user after workspace provisioning failure.', cleanupError);
      }
    }

    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.error('Failed to sign out after workspace provisioning failure.', signOutError);
    }

    redirect(
      `/signup?error=${encodeURIComponent(
        'We could not finish creating your workspace. Please try again or contact support if the problem continues.',
      )}`,
    );
  }

  redirect('/onboarding');
}

export async function completeOnboardingAction(formData: FormData) {
  const session = await requireSession();
  const businessName = getString(formData, 'businessName') || session.business.name;
  const timezone = getString(formData, 'timezone') || session.business.timezone;

  await updateBusinessOnboarding({
    businessId: session.business.id,
    businessName,
    timezone,
  });

  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
