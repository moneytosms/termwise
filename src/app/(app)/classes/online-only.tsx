"use client";

import { useEffect, useState } from "react";
import { NeedsConnection } from "@/components/states";

/** The server-rendered sections need a connection; the phone shows Needs a connection in their place. */
export function OnlineOnly({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const check = () => setOnline(navigator.onLine);
    check();
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, []);
  return online ? children : <NeedsConnection onRetry={() => window.location.reload()} />;
}
