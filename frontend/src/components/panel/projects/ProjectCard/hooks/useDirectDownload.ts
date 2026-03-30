/**
 * @file useProjectExport.ts
 * @description Custom hook managing the asynchronous document generation and download lifecycle.
 * @architecture
 * Implements the "Headless UI" pattern for file downloads. Encapsulates Blob memory 
 * management (preventing memory leaks via revokeObjectURL), HTTP header parsing for 
 * dynamic filenames, and integrated toast notification states (Sonner).
 * @module project/ProjectCard/hooks
 * @author Krystian Bugalski
 */

import { useState } from 'react';
import { toast } from 'sonner';
import api from '../../../../../utils/api';

export function useProjectExport(projectId: number | string) {
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const downloadReport = async (endpoint: string, defaultFilename: string, loaderKey: string) => {
    setIsDownloading(loaderKey);
    const toastId = toast.loading("Generating document...");
    
    try {
      const response = await api.get(`/api/projects/${projectId}/${endpoint}/`, { responseType: 'blob' });
      const disposition = response.headers['content-disposition'];
      let filename = defaultFilename;
      
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Document downloaded successfully.", { id: toastId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate document.";
      toast.error("Generation Error", { id: toastId, description: message });
    } finally {
      setIsDownloading(null);
    }
  };

  return { downloadReport, isDownloading };
}