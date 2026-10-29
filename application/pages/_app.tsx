import type { AppProps } from "next/app";
import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { TeamProvider } from "@/context/team-context";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/pages";
import "@/styles/globals.css";
function OwnerBoundary({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const publicPage = ["/login", "/view/[id]"].includes(router.pathname);
  useEffect(() => {
    if (status === "unauthenticated" && !publicPage)
      void router.replace("/login");
  }, [status, publicPage, router]);
  if (!publicPage && status !== "authenticated")
    return <div className="p-8">Loading…</div>;
  return <>{children}</>;
}
export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider delayDuration={100}>
          <Toaster closeButton />
          <NuqsAdapter><OwnerBoundary>
            <TeamProvider>
              <Component {...pageProps} />
            </TeamProvider>
          </OwnerBoundary></NuqsAdapter>
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
