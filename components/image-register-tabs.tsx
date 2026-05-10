'use client';

import { useId, useState } from 'react';
import { ImageRegisterForm } from '@/components/image-register-form';
import { ImageSearchPicker } from '@/components/image-search-picker';

type Tab = 'url' | 'search';

const TABS: ReadonlyArray<{ id: Tab; label: string; testId: string }> = [
  { id: 'url', label: 'URL 入力', testId: 'image-register-tab-url' },
  { id: 'search', label: 'キーワード検索', testId: 'image-register-tab-search' },
];

export function ImageRegisterTabs() {
  const [active, setActive] = useState<Tab>('url');
  const baseId = useId();

  // WAI-ARIA tablist パターン: ArrowLeft/ArrowRight でタブ間フォーカスを循環させる
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + TABS.length) % TABS.length;
    const nextTab = TABS[nextIndex];
    if (nextTab) setActive(nextTab.id);
  };

  return (
    <div className="space-y-4" data-testid="image-register-tabs">
      <div role="tablist" aria-label="画像の登録方法" className="flex border-b">
        {TABS.map((tab, index) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              data-testid={tab.testId}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={
                selected
                  ? 'px-4 py-2 text-sm font-medium border-b-2 border-gray-900 text-gray-900'
                  : 'px-4 py-2 text-sm text-gray-500 hover:text-gray-900'
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-url`}
        aria-labelledby={`${baseId}-tab-url`}
        hidden={active !== 'url'}
      >
        {active === 'url' ? <ImageRegisterForm /> : null}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-search`}
        aria-labelledby={`${baseId}-tab-search`}
        hidden={active !== 'search'}
      >
        {active === 'search' ? <ImageSearchPicker /> : null}
      </div>
    </div>
  );
}
