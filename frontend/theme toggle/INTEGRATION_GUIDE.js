/**
 * HOW TO WIRE THE THEME TOGGLE INTO YOUR APP
 * ──────────────────────────────────────────
 * Below is a minimal example of the changes needed in your MainLayout component.
 * Adapt the exact JSX to match your existing MainLayout structure.
 */

// 1. Import the hook and component
import { useTheme }   from '../../hooks/useTheme';     // adjust path
import ThemeToggle    from '../common/ThemeToggle';     // adjust path

// 2. Inside your MainLayout (or whichever component owns the topbar):
const MainLayout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-container">

      {/* ── Sidebar (unchanged) ── */}
      <aside className="sidebar">
        {/* ... your existing sidebar JSX ... */}
      </aside>

      {/* ── Main area ── */}
      <div className="main-content">

        {/* ── Topbar — add ThemeToggle here ── */}
        <header className="topbar">
          {/* existing topbar content, e.g. page title, breadcrumbs … */}
          <span style={{ flex: 1 }} />          {/* push toggle to the right */}
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </header>

        {/* ── Page content (unchanged) ── */}
        <main className="page-container">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

/**
 * FILE PLACEMENT GUIDE
 * ──────────────────────────────────────────
 * src/
 *   hooks/
 *     useTheme.js            ← paste useTheme.js here
 *   components/
 *     common/
 *       ThemeToggle.jsx      ← paste ThemeToggle.jsx here
 *     layout/
 *       MainLayout.jsx       ← wire as shown above
 *   index.css                ← replace entirely with the new index.css
 *
 * That's it — no Context changes, no extra libraries.
 * localStorage key: "theme"  →  "dark" | "light"
 */
