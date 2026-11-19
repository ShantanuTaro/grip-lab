import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Link, navigate, usePath } from './router.tsx';
import Capture from './screens/Capture.tsx';
import Grounds from './screens/Grounds.tsx';
import Label from './screens/Label.tsx';
import Simulator from './screens/Simulator.tsx';
import { setTheme, useTheme } from './theme.ts';
import { Logo, Segmented } from './ui.tsx';

const SCREENS = [
  { path: '/simulator', name: 'Simulator', short: 'Simulator', Screen: Simulator },
  { path: '/grounds', name: 'My grounds', short: 'Grounds', Screen: Grounds },
  { path: '/capture', name: 'Grip capture', short: 'Capture', Screen: Capture },
  { path: '/label', name: 'Label photos', short: 'Label', Screen: Label },
];

function App() {
  const path = usePath();
  const current = SCREENS.find((s) => s.path === path);
  const theme = useTheme();
  useEffect(() => {
    if (!current) navigate('/simulator', true);
    else document.title = `${current.name} · Grip Lab`;
  }, [current]);

  return (
    <div className={`flex min-h-dvh flex-col bg-bg text-text ${current?.path === '/simulator' ? 'lg:h-dvh' : ''}`}>
      <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-line px-4 py-1.5 lg:gap-x-6 lg:px-6 lg:py-3.5">
        <Link to="/simulator" className="flex items-center gap-2.5 text-text no-underline">
          <Logo className="size-7 lg:size-8" />
          <span className="font-display text-2xl font-bold tracking-[0.02em] uppercase lg:text-[28px]">Grip Lab</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-0.5 text-sm sm:text-[15px] lg:gap-2">
          {SCREENS.map((s) => (
            <Link
              key={s.path}
              to={s.path}
              aria-current={s === current ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-[10px] px-2 font-semibold no-underline lg:px-4 ${s === current ? 'bg-raised text-text' : 'hover:text-text'}`}
            >
              <span className="sm:hidden">{s.short}</span>
              <span className="hidden sm:inline">{s.name}</span>
            </Link>
          ))}
        </nav>
        <Segmented
          label="Colour mode"
          options={[['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light']]}
          value={theme}
          onChange={setTheme}
          className="text-sm max-sm:w-full"
        />
      </header>
      {current && <current.Screen />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
