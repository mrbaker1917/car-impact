import { type MouseEvent, type ReactNode } from "react";

export function NavLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  const href = `${to}${window.location.search}`;
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    if (`${window.location.pathname}${window.location.search}` === href) return;
    history.pushState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

export function SiteLink({ className }: { className?: string }) {
  return (
    <a
      className={className}
      href="https://mrbaker1917.com"
      target="_blank"
      rel="noreferrer"
      title="Click the link to visit author's site."
    >
      site's author
    </a>
  );
}
