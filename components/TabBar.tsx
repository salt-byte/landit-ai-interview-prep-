import React from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

export function TabBar<T extends string>({ tabs, active, onChange, className = '' }: TabBarProps<T>) {
  return (
    <div className={`border-b border-[#E3E3E3] ${className}`}>
      <div className="flex items-center gap-8 px-8">
        {tabs.map(tab => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative py-3 text-sm font-bold transition-colors outline-none ${
                isActive
                  ? 'text-[#1F1F1F]'
                  : 'text-[#80868B] hover:text-[#1F1F1F]'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-[2.5px] bg-[#1F1F1F] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
