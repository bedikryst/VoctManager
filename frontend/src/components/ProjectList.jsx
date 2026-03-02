/**
 * ProjectList Component
 * @author Krystian Bugalski
 * * Presentational component displaying a data table of upcoming concerts.
 * Interacts with the parent state via the onSelectProject callback when a row is clicked.
 * * @param {Array} projects - Array of project objects to display.
 * @param {Function} onSelectProject - Callback function triggered upon selecting a specific project row.
 */
export default function ProjectList({ projects, onSelectProject }) {
  return (
    <div className="animate-fade-in p-6">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-4 border-b border-stone-200 pb-2">
        <h2 className="text-xl font-serif font-bold text-stone-800">Bieżący harmonogram</h2>
        <span className="text-xs font-bold uppercase tracking-widest text-stone-500">
          Liczba projektów: {projects.length}
        </span>
      </div>
      
      {/* CONDITIONAL RENDERING based on data availability */}
      {projects.length === 0 ? (
        <div className="bg-stone-50 p-6 border border-stone-200 border-dashed text-center text-sm text-stone-500">
          Brak nadchodzących projektów w Twoim kalendarzu.
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-sm shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-stone-600">
            <thead className="bg-stone-100 text-[10px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 w-32">Data</th>
                <th className="px-4 py-3">Wydarzenie</th>
                <th className="px-4 py-3 hidden md:table-cell">Lokalizacja</th>
                <th className="px-4 py-3 text-right">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {projects.map(proj => (
                <tr 
                  key={proj.id} 
                  onClick={() => onSelectProject(proj)}
                  className="hover:bg-stone-50 transition-colors group cursor-pointer"
                >
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-stone-800">
                    {proj.start_date}
                  </td>
                  <td className="px-4 py-3 font-bold text-stone-900 group-hover:text-amber-700 transition-colors">
                    {proj.title}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs">
                    {proj.location || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-[10px] font-bold uppercase tracking-wider text-stone-500 group-hover:text-stone-900 border border-stone-200 group-hover:border-stone-400 px-3 py-1.5 rounded-sm bg-white transition-all">
                      Otwórz →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
    </div>
  );
}