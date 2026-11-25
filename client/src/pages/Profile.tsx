import { Redirect } from "wouter";

/** Preferences live in Settings (saved to the server); this route is kept so old links still work. */
export default function Profile() {
  return <Redirect to="/settings" />;
}
