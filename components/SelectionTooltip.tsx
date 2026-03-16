
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Quote, Sparkles } from 'lucide-react';

interface SelectionTooltipProps {
  onQuote: (text: string) => void;
  onAIEdit: (text: string) => void;
  containerRef: React.RefObject<HTMLElement>;
}

const SelectionTooltip: React.FC<SelectionTooltipProps> = ({ onQuote, onAIEdit, containerRef }) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setPosition(null);
      setSelectedText('');
      return;
    }

    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    
    // Check if selection is within the container
    if (containerRef.current && !containerRef.current.contains(range.commonAncestorContainer)) {
      setPosition(null);
      setSelectedText('');
      return;
    }

    const rect = range.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    setPosition({
      top: rect.top + scrollY - 40, // Position above the selection
      left: rect.left + scrollX + rect.width / 2,
    });
    setSelectedText(text);
  }, [containerRef]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', (e) => {
      if (tooltipRef.current && tooltipRef.current.contains(e.target as Node)) {
        return;
      }
      // If clicking outside, the selectionchange event will handle it
    });

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedText && (e.key === 'Enter' || (e.ctrlKey && e.altKey && e.key === 'q'))) {
        onQuote(selectedText);
        window.getSelection()?.removeAllRanges();
        setPosition(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedText, onQuote]);

  if (!position) return null;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] -translate-x-1/2 flex items-center gap-1 bg-white border border-[#E3E3E3] shadow-lg rounded-full p-1 animate-in fade-in zoom-in-95 duration-150"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => {
          onQuote(selectedText);
          // window.getSelection()?.removeAllRanges(); // Keep selection for context
          setPosition(null);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#F0F4F9] transition-all group"
      >
        <Quote className="w-3.5 h-3.5 text-[#0B57D0] group-hover:scale-110 transition-transform" />
        <span className="text-xs font-bold text-[#1F1F1F]">Quote</span>
      </button>
      
      <div className="w-px h-4 bg-[#E3E3E3] mx-0.5" />
      
      <button
        onClick={() => {
          onAIEdit(selectedText);
          // Do not remove ranges so we can replace the selection later
          setPosition(null);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#F0F4F9] transition-all group"
      >
        <Sparkles className="w-3.5 h-3.5 text-[#0B57D0] group-hover:scale-110 transition-transform" />
        <span className="text-xs font-bold text-[#1F1F1F]">AI Edit</span>
      </button>
    </div>
  );
};

export default SelectionTooltip;
