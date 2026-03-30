import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { getJournal } from '../data/journalStore';
import HomeButton from '../components/HomeButton';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';

export default function Journal() {
  const { t } = useLang();
  const navigate = useNavigate();
  const journal = getJournal();
  const j = t.journal;

  const formatDate = (dateStr) => {
    const d    = new Date(dateStr + 'T12:00:00');
    const jour  = String(d.getDate()).padStart(2, '0');
    const mois  = String(d.getMonth() + 1).padStart(2, '0');
    const annee = d.getFullYear();
    return `${jour}/${mois}/${annee}`;
  };

  return (
    <div className="min-h-dvh bg-bg2 flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 py-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <HomeButton />
            <h1 className="text-xl font-bold text-text">{j.title}</h1>
          </div>
          <ThemeToggle />
        </div>

        {/* Journal entries */}
        {journal.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-4xl mb-4">📖</span>
            <p className="text-text3 text-sm">{j.noActivity}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {journal.map((day, dayIdx) => (
              <div key={day.date} className="rounded-2xl bg-card border border-border p-4">
                <p className="text-xs font-semibold text-primary uppercase mb-3 capitalize">
                  {formatDate(day.date)}
                </p>
                <div className="flex flex-col gap-2">
                  {day.entries.map((entry, i) => {
                    const catLabel = t.categories?.[entry.category] || entry.category;
                    const subLabel = t.subcategories?.[entry.category]?.[entry.sub] || entry.sub;

                    if (entry.type === 'session') {
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-success mt-0.5">●</span>
                          <p className="text-sm text-text">
                            <span className="font-semibold">{entry.learned}</span> {j.learned} {catLabel} · {subLabel}
                          </p>
                        </div>
                      );
                    }
                    if (entry.type === 'review') {
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-reminder mt-0.5">●</span>
                          <p className="text-sm text-text">
                            <span className="font-semibold">{entry.reviewed}</span> {j.reviewed}, <span className="font-semibold">{entry.mastered}</span> {j.mastered}
                          </p>
                        </div>
                      );
                    }
                    if (entry.type === 'newSession') {
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">●</span>
                          <p className="text-sm text-text">{j.openedNew}: {catLabel} · {subLabel}</p>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
