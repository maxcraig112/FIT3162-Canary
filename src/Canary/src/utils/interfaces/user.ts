import { CallAPI, authServiceUrl } from '../apis';

export interface UserDetails {
  userID: string;
  email: string;
}

export interface UserLookupResponse {
  users: UserDetails[];
}

/**
 * Get user details (email) for multiple user IDs
 */
export async function getUserDetails(userIDs: string[]): Promise<UserDetails[]> {
  if (!userIDs.length) return [];

  try {
    const base = authServiceUrl();
    if (!base) throw new Error('Auth service URL not configured');

    const url = `${base}/users/lookup`;
    const response = await CallAPI<UserLookupResponse>(url, {
      method: 'POST',
      json: { userIDs },
    });

    return response?.users || [];
  } catch (error) {
    console.warn('Failed to lookup user details:', error);
    // Return userIDs as fallback
    return userIDs.map((userID) => ({ userID, email: userID }));
  }
}

/**
 * Get user details for a single user ID
 */
export async function getUserDetail(userID: string): Promise<UserDetails> {
  const users = await getUserDetails([userID]);
  return users[0] || { userID, email: userID };
}
