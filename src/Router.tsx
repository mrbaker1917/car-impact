import { useEffect, useState } from "react";
import App from "./App";
import Details from "./Details";

function currentPath(): string {
  return window.location.pathname.replace(/\/$/, "") || "/";
}

export function Router() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path === "/details" ? <Details /> : <App />;
}
