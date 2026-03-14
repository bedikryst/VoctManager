import api from './api';

/**
 * Pobiera plik binarny (PDF/ZIP/Audio) z API autoryzowanego przez JWT
 * i wymusza okno dialogowe zapisu w przeglądarce.
 * * @param {string} url - Ścieżka do endpointu (np. '/api/participations/1/contract/')
 * @param {string} defaultFilename - Zapasowa nazwa pliku, jeśli backend jej nie poda
 */
export const downloadFile = async (url, defaultFilename) => {
  try {
    const response = await api.get(url, { responseType: 'blob' });
    
    const disposition = response.headers['content-disposition'];
    let finalFilename = defaultFilename;
    
    // Wyciągamy oryginalną nazwę pliku wygenerowaną przez Django (jeśli istnieje)
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match != null && match[1]) {
        finalFilename = match[1].replace(/['"]/g, '');
      }
    }
    
    // Tworzymy ukryty link i wymuszamy kliknięcie
    const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    
    // Sprzątamy pamięć RAM
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Błąd pobierania pliku:", error);
    throw new Error('Błąd podczas pobierania pliku. Sprawdź połączenie z serwerem.');
  }
};