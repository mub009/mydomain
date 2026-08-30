import { CATEGORY_SHOWCASE, ShowcaseItem } from "@/data/categoryShowcase";
import { getCategoryIcon } from "@/lib/categoryIcons";

// A random stock photo (picsum.photos, keyed only by a seed string) has no
// idea what "Bridal Requisite" or "AC Service" means, so it was as likely to
// show a mountain or an ocean wave as anything related — the icon tile below
// is what every tile actually used once that photo failed to load, so it's
// used directly instead of gambling on a photo that usually didn't match.
function ShowcaseTile({ item, onSelect }: { item: ShowcaseItem; onSelect: (query: string) => void }) {
  const { icon: Icon, tint } = getCategoryIcon(item.label);

  return (
    <button onClick={() => onSelect(item.query)} className="text-left group">
      <div className={`aspect-[4/3] w-full rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${tint}`}>
        <Icon size={28} />
      </div>
      <p className="text-sm font-medium text-ink-800 mt-2 group-hover:text-brand-600 transition-colors">
        {item.label}
      </p>
    </button>
  );
}

export default function CategoryShowcase({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-ink-900 mb-3">Explore popular services</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CATEGORY_SHOWCASE.map((group) => (
          <div key={group.title} className="card p-5">
            <h3 className="font-bold text-ink-900 mb-3">{group.title}</h3>
            <div className="grid grid-cols-3 gap-3">
              {group.items.map((item) => (
                <ShowcaseTile key={item.label} item={item} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
