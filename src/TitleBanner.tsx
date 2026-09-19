export const SITE_TITLE = "Environmental Impact of Cars in Canada";

export function TitleBanner({ as = "h1" }: { as?: "h1" | "p" }) {
  const Tag = as;
  return (
    <div className="title-banner">
      <div className="title-banner-inner">
        <Tag className="title-banner-text">{SITE_TITLE}</Tag>
      </div>
    </div>
  );
}
