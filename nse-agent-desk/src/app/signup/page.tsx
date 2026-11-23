import { AuthScreen } from "@/components/desk/auth-screen";

export const metadata = { title: "Create account · NSE Agent Desk" };

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
