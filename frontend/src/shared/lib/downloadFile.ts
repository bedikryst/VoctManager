/**
 * @file downloadFile.ts
 * @description Utility function for securely downloading binary files (PDF/ZIP/Audio).
 * Fetches the blob using the authorized JWT API instance and triggers 
 * the browser's native save dialog.
 * @architecture Enterprise 2026 Standards
 * @module utils/downloadFile
 */

import api from '../api/api';

export const downloadFile = async (url: string, defaultFilename: string): Promise<void> => {
  try {
    const response = await api.get(url, { responseType: 'blob' });
    
    const disposition: string | undefined = response.headers['content-disposition'];
    let finalFilename = defaultFilename;
    
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match != null && match[1]) {
        finalFilename = match[1].replace(/['"]/g, '');
      }
    }
    
    const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = downloadUrl;
    anchor.download = finalFilename;
    document.body.appendChild(anchor);
    anchor.click();
    
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(anchor);
  } catch (error) {
    console.error("System Error: Secure file download failed.", error);
    throw new Error('Błąd podczas pobierania pliku. Sprawdź połączenie z serwerem.');
  }
};