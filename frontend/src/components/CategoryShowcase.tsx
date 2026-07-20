import { useState } from "react";
import { CATEGORY_SHOWCASE, ShowcaseItem } from "@/data/categoryShowcase";
import { getCategoryIcon } from "@/lib/categoryIcons";

function ShowcaseTile({ item, onSelect }: { item: ShowcaseItem; onSelect: (query: string) => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { icon: Icon, tint } = getCategoryIcon(item.label);

  return (
    <button onClick={() => onSelect(item.query)} className="text-left group">
      <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-gray-100 relative">
        {!imgFailed ? (
          <img
            src={`https://picsum.photos/seed/${item.seed}/300/220`}
            alt={item.label}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className={`h-full w-full flex items-center justify-center ${tint}`}>
            <Icon size={28} />
          </div>
        )}
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
