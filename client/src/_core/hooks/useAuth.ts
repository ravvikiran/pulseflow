/**
 * useAuth hook — No authentication system configured.
 * Always returns authenticated state with a local user.
 * All features are accessible without login.
 */
export function useAuth() {
  return {
    user: { id: 1, name: "Local User", email: null, role: "admin" },
    loading: false,
    error: null,
    isAuthenticated: true,
    refresh: () => {},
    logout: async () => {},
  };
}
