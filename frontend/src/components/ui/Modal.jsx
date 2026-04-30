import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ title, onClose, children, size = 'md' }) {
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center p-4 pt-16 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} bg-white rounded-xl shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-forest-100">
          <h2 className="text-lg font-semibold text-forest-900">{title}</h2>
          <button onClick={onClose} className="text-forest-400 hover:text-forest-700 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
