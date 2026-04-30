import { NavLink, Outlet, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import bdLogo from '../../assets/BD_logo.jpg';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  usePageTitle();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-forest-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={bdLogo} alt="Bloomsday Natives" className="h-9 w-auto rounded" />
            <span className="font-serif text-xl font-semibold tracking-tight">Bloomsday Natives</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <NavLink to="/"        end className={({isActive})=> isActive ? 'text-white font-medium' : 'text-forest-300 hover:text-white transition-colors'}>Home</NavLink>
            <NavLink to="/catalog"     className={({isActive})=> isActive ? 'text-white font-medium' : 'text-forest-300 hover:text-white transition-colors'}>Plant Catalog</NavLink>
            <NavLink to="/preorder"    className={({isActive})=> isActive ? 'text-white font-medium' : 'text-forest-300 hover:text-white transition-colors'}>Pre-Order</NavLink>
          </nav>
          <button className="md:hidden text-forest-300" onClick={() => setOpen(!open)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-forest-700 py-3 px-4 flex flex-col gap-3 text-sm">
            <NavLink to="/"        end onClick={() => setOpen(false)} className="text-forest-200">Home</NavLink>
            <NavLink to="/catalog"     onClick={() => setOpen(false)} className="text-forest-200">Plant Catalog</NavLink>
            <NavLink to="/preorder"    onClick={() => setOpen(false)} className="text-forest-200">Pre-Order</NavLink>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-forest-900 text-forest-400 text-sm py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={bdLogo} alt="Bloomsday Natives" className="h-7 w-auto rounded opacity-80" />
            <span className="text-forest-300 font-medium">Bloomsday Natives</span>
          </div>
          <p>Native plants for Pacific Northwest landscapes</p>
          <a href="/admin" className="text-forest-500 hover:text-forest-300 transition-colors text-xs">Admin</a>
        </div>
      </footer>
    </div>
  );
}
