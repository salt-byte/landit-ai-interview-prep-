import React, { useImperativeHandle, forwardRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Bold, List, ListOrdered, ChevronDown, Highlighter, Undo, Redo, Loader2, Check, Heading1, Heading2, Type } from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onAskCoPilot?: (text: string) => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

export interface RichTextEditorHandle {
  setContent: (content: string) => void;
  replaceSelection: (text: string) => void;
  undo: () => void;
  setHighlight: (color?: string) => void;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(({ content, onChange, placeholder, onAskCoPilot, saveStatus = 'idle' }, ref) => {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Highlight.configure({ multicolor: true }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Tab') {
          event.preventDefault();
          if (event.shiftKey) {
            // Shift+Tab: Outdent
            // Check if list item
            if (editor?.isActive('bulletList') || editor?.isActive('orderedList')) {
               editor?.chain().focus().liftListItem('listItem').run();
               return true;
            }
          } else {
            // Tab: Indent
            if (editor?.isActive('bulletList') || editor?.isActive('orderedList')) {
               editor?.chain().focus().sinkListItem('listItem').run();
               return true;
            }
            // Insert tab char if not list? Or ignore.
            editor?.chain().focus().insertContent('\t').run();
            return true;
          }
        }
        return false;
      }
    }
  });

  useImperativeHandle(ref, () => ({
    setContent: (newContent: string) => {
      editor?.commands.setContent(newContent);
    },
    replaceSelection: (text: string) => {
      editor?.chain().focus().insertContent(text).run();
    },
    undo: () => {
      editor?.chain().focus().undo().run();
    },
    setHighlight: (color?: string) => {
      if (color) {
        editor?.chain().focus().setHighlight({ color }).run();
      } else {
        editor?.chain().focus().unsetHighlight().run();
      }
    },
  }));

  if (!editor) {
    return null;
  }

  const toggleHeading = (level: 1 | 2 | 0) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
    setShowHeadingMenu(false);
  };

  const toggleList = (type: 'bullet' | 'ordered') => {
    if (type === 'bullet') {
      editor.chain().focus().toggleBulletList().run();
    } else {
      editor.chain().focus().toggleOrderedList().run();
    }
    setShowListMenu(false);
  };

  return (
    <div className="flex flex-col border border-[#E3E3E3] rounded-xl shadow-sm bg-white overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-[#E3E3E3] bg-[#F8F9FA]">
        <div className="flex items-center gap-1">
          {/* Heading Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowHeadingMenu(!showHeadingMenu)} 
              className="flex items-center gap-1 p-1.5 rounded hover:bg-[#E3E3E3] text-xs font-medium text-[#444746]" 
              title="Text Style"
            >
              {editor.isActive('heading', { level: 1 }) ? <Heading1 className="w-4 h-4" /> : 
               editor.isActive('heading', { level: 2 }) ? <Heading2 className="w-4 h-4" /> : 
               <Type className="w-4 h-4" />}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showHeadingMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#E3E3E3] rounded-lg shadow-lg z-10 w-32 overflow-hidden py-1">
                <button onClick={() => toggleHeading(1)} className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-[#F0F4F9] ${editor.isActive('heading', { level: 1 }) ? 'bg-[#E8F0FE] text-[#0B57D0]' : 'text-[#1F1F1F]'}`}>
                  <Heading1 className="w-4 h-4" /> Heading 1
                </button>
                <button onClick={() => toggleHeading(2)} className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-[#F0F4F9] ${editor.isActive('heading', { level: 2 }) ? 'bg-[#E8F0FE] text-[#0B57D0]' : 'text-[#1F1F1F]'}`}>
                  <Heading2 className="w-4 h-4" /> Heading 2
                </button>
                <button onClick={() => toggleHeading(0)} className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-[#F0F4F9] ${!editor.isActive('heading') ? 'bg-[#E8F0FE] text-[#0B57D0]' : 'text-[#1F1F1F]'}`}>
                  <Type className="w-4 h-4" /> Normal Text
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-[#E3E3E3] mx-1" />

          {/* Bold */}
          <button 
            onClick={() => editor.chain().focus().toggleBold().run()} 
            className={`p-1.5 rounded hover:bg-[#E3E3E3] transition-colors ${editor.isActive('bold') ? 'bg-[#E3E3E3] text-[#1F1F1F]' : 'text-[#444746]'}`} 
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>

          {/* Highlight (Pale Yellow) */}
          <button 
            onClick={() => editor.chain().focus().toggleHighlight({ color: '#FFF9C4' }).run()} 
            className={`p-1.5 rounded hover:bg-[#E3E3E3] transition-colors ${editor.isActive('highlight', { color: '#FFF9C4' }) ? 'bg-[#FFF9C4] text-[#1F1F1F]' : 'text-[#444746]'}`} 
            title="Highlight"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-[#E3E3E3] mx-1" />

          {/* List Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowListMenu(!showListMenu)} 
              className={`p-1.5 rounded hover:bg-[#E3E3E3] transition-colors ${editor.isActive('bulletList') || editor.isActive('orderedList') ? 'bg-[#E3E3E3] text-[#1F1F1F]' : 'text-[#444746]'}`} 
              title="Lists"
            >
              <List className="w-4 h-4" />
            </button>
            {showListMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#E3E3E3] rounded-lg shadow-lg z-10 w-36 overflow-hidden py-1">
                <button onClick={() => toggleList('bullet')} className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-[#F0F4F9] ${editor.isActive('bulletList') ? 'bg-[#E8F0FE] text-[#0B57D0]' : 'text-[#1F1F1F]'}`}>
                  <List className="w-4 h-4" /> Bulleted list
                </button>
                <button onClick={() => toggleList('ordered')} className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-[#F0F4F9] ${editor.isActive('orderedList') ? 'bg-[#E8F0FE] text-[#0B57D0]' : 'text-[#1F1F1F]'}`}>
                  <ListOrdered className="w-4 h-4" /> Numbered list
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-[#E3E3E3] mx-1" />

          {/* Undo/Redo */}
          <button onClick={() => editor.chain().focus().undo().run()} className="p-1.5 rounded hover:bg-[#E3E3E3] text-[#444746]" title="Undo"><Undo className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().redo().run()} className="p-1.5 rounded hover:bg-[#E3E3E3] text-[#444746]" title="Redo"><Redo className="w-4 h-4" /></button>
        </div>

        {/* Auto-save Indicator */}
        <div className="flex items-center gap-2 px-2">
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#444746] animate-in fade-in">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#444746] animate-in fade-in">
              <Check className="w-3 h-3" />
              <span>Saved</span>
            </div>
          )}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
});

export default RichTextEditor;
