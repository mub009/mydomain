import { AuthScreen } from "@/components/desk/auth-screen";

export const metadata = { title: "Log in · NSE Agent Desk" };

export default function LoginPage() {
  return <AuthScreen mode="login" />;
}
