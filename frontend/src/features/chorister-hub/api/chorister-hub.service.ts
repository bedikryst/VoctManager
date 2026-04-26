// chorister-hub/api/chorister-hub.service.ts
import api from '@/shared/api/api';
import type {
  DocumentCategoryDTO,
  DocumentCategoryCreateDTO,
  DocumentCategoryUpdateDTO,
  DocumentFileDTO,
  ArtistIdentityMetricsDTO,
} from '../types/chorister-hub.dto';

const API_BASE = '/api/documents';

export const ChoristerHubService = {
  getCategories: (): Promise<DocumentCategoryDTO[]> =>
    api.get<DocumentCategoryDTO[]>(`${API_BASE}/categories/`).then((r) => r.data),

  createCategory: (dto: DocumentCategoryCreateDTO): Promise<DocumentCategoryDTO> =>
    api.post<DocumentCategoryDTO>(`${API_BASE}/categories/`, dto).then((r) => r.data),

  updateCategory: (id: string, dto: DocumentCategoryUpdateDTO): Promise<DocumentCategoryDTO> =>
    api.patch<DocumentCategoryDTO>(`${API_BASE}/categories/${id}/`, dto).then((r) => r.data),

  deleteCategory: (id: string): Promise<void> =>
    api.delete(`${API_BASE}/categories/${id}/`).then(() => undefined),

  uploadDocument: (categoryId: string, formData: FormData): Promise<DocumentFileDTO> =>
    api
      .post<DocumentFileDTO>(`${API_BASE}/categories/${categoryId}/documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  deleteDocument: (categoryId: string, documentId: string): Promise<void> =>
    api
      .delete(`${API_BASE}/categories/${categoryId}/documents/${documentId}/`)
      .then(() => undefined),

  getArtistMetrics: (): Promise<ArtistIdentityMetricsDTO> =>
    api.get<ArtistIdentityMetricsDTO>(`${API_BASE}/artist-metrics/`).then((r) => r.data),

  fetchDocumentBlob: (documentId: string): Promise<Blob> =>
    api
      .get(`${API_BASE}/${documentId}/download/`, { responseType: 'blob' })
      .then((r) => r.data as Blob),
};
