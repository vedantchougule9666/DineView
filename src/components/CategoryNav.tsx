import { MenuCategory } from '../data/menu';

interface CategoryNavProps {
  categories: MenuCategory[];
  activeCategory: string;
  onSelectCategory: (id: string) => void;
  translations: Record<string, string>;
}

export function CategoryNav({ categories, activeCategory, onSelectCategory, translations }: CategoryNavProps) {
  return (
    <div className="sticky top-20 z-40 bg-bg-primary/95 backdrop-blur-md border-b border-border">
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <ul className="flex overflow-x-auto hide-scrollbar py-6 gap-8 items-center">
          {categories.map((category) => {
            const isActive = category.id === activeCategory;
            return (
              <li key={category.id} className="shrink-0">
                <button
                  onClick={() => onSelectCategory(category.id)}
                  className={`text-lg font-serif transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-accent border-b-2 border-accent pb-1'
                      : 'text-text-secondary hover:text-text-primary pb-1'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {translations[category.id] || translations[category.name] || category.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
