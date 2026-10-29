import Head from "next/head";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const result = await signIn("owner", {
        password: String(form.get("password")),
        redirect: false,
      });
      if (result?.ok) window.location.assign("/documents");
      else
        setError(
          "Unable to sign in. Check your password or try again shortly.",
        );
    } catch {
      setError("Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Head>
        <title>Papermark · Sign in</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-black">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Papermark</CardTitle>
            <CardDescription>
              Sign in to your private workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={login} className="space-y-4">
              <Label htmlFor="password">Owner password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
              <Button className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
