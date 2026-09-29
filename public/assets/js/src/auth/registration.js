import { updateAvatar } from './avatar.js';
import { updateProvisionedNickname, waitForProvisionedProfile } from './profile.js';

export class RegistrationCompletionError extends Error {
  constructor(code, cause) {
    super(code, cause ? { cause } : undefined);
    this.name = 'RegistrationCompletionError';
    this.code = code;
    this.accountCreated = true;
  }
}

export async function registerUser(
  client,
  { email, password, redirectTo, nickname = '', avatarFile = null, profileWaitOptions, onStage = () => undefined }
) {
  onStage('signing_up');
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { redirectTo }
  });
  if (error) throw error;
  if (!data?.user) throw new Error('AUTH_USER_MISSING');
  onStage(data.session ? 'completing_profile' : 'confirmation_required');

  const completion = await completeRegistrationProfile(client, {
    user: data.user,
    session: data.session,
    nickname,
    avatarFile,
    profileWaitOptions,
    onStage
  });
  return { accountCreated: true, user: data.user, session: data.session, completion };
}

export async function completeRegistrationProfile(
  client,
  { user, session, nickname = '', avatarFile = null, profileWaitOptions, onStage = () => undefined }
) {
  if (!user?.id) throw new RegistrationCompletionError('AUTH_USER_MISSING');

  if (!session?.user?.id || session.user.id !== user.id) {
    return { status: 'confirmation_required', profile: null, avatarUrl: null };
  }

  let profile;
  try {
    profile = await waitForProvisionedProfile(client, user.id, profileWaitOptions);
  } catch (error) {
    throw new RegistrationCompletionError(
      error?.message === 'PROFILE_NOT_PROVISIONED' ? 'PROFILE_NOT_PROVISIONED' : 'PROFILE_CONFIRMATION_FAILED',
      error
    );
  }

  const normalizedNickname = nickname.trim();
  if (normalizedNickname) {
    onStage('saving_nickname');
    try {
      await updateProvisionedNickname(client, user.id, normalizedNickname);
    } catch (error) {
      throw new RegistrationCompletionError('NICKNAME_UPDATE_FAILED', error);
    }
  }

  if (!avatarFile) return { status: 'complete', profile, avatarUrl: null };

  try {
    onStage('uploading_avatar');
    const avatarUrl = await updateAvatar(client, user.id, profile.avatar_url, avatarFile);
    return { status: 'complete', profile, avatarUrl };
  } catch (error) {
    return { status: 'avatar_deferred', profile, avatarUrl: null, error };
  }
}
