/**
 * Renders a schema.org JSON-LD block. `<` is escaped so user-derived strings
 * (dish titles, place names) can never break out of the script tag.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
